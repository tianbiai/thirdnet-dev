# -*- coding: utf-8 -*-
"""
测试中枢（通用层）：
- 启动/关闭 Playwright 与浏览器；
- 自动捕获 bug：console error/warning、pageerror、4xx/5xx 响应（原则 #5 被动监听）；
- 支持标记「预期失败」（如冲突 409、负向 4xx）以免误报；
- 失败截图；
- 后端健康检查轮询（仅探活）；
- 汇总 findings.json + TEST_REPORT.md。

【通用层】按原样拷贝即可。被动监听是纯 UI 套件的「捕虫网」——它只观察被测前端
自身发出的请求与报错，不连接后端、不替前端发请求。
"""
import json
import os
import time
import traceback
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, Request, Response, ConsoleMessage, Error as PWError

import config as cfg
from lib import state

# {{ADAPT}} 报告标题
REPORT_TITLE = "E2E 测试报告"


class Findings:
    def __init__(self):
        self.items = []              # 所有捕获项
        self._expect = []            # 预期失败规则 [(url_substring, status), ...]
        self._console_disabled = []  # 忽略的控制台消息子串
        self.current_stage = None    # 当前阶段名（由 TestRunner.set_stage 设置，给捕获项盖阶段戳）

    # ---- 预期失败注册 ----
    def expect_response(self, url_substring, status):
        """注册一个「预期会发生的失败」（如会议冲突 409），不计为 bug。"""
        self._expect.append((url_substring, status))

    def ignore_console(self, substring):
        self._console_disabled.append(substring)

    def _is_expected(self, url, status):
        for sub, st in self._expect:
            if sub in url and st == status:
                return True
        return False

    # ---- 捕获 ----
    def add(self, kind, severity, message, tag="", **extra):
        item = {
            "kind": kind, "severity": severity, "message": message,
            "tag": tag, "time": time.strftime("%H:%M:%S"),
            "stage": self.current_stage, **extra,   # 阶段归属；extra 显式传 stage 则覆盖
        }
        self.items.append(item)

    def on_console(self, tag, msg: ConsoleMessage):
        if msg.type not in ("error", "warning"):
            return
        text = msg.text or ""
        for sub in self._console_disabled:
            if sub in text:
                return
        # 噪音过滤：第三方资源加载失败、favicon、开发工具提示等
        if any(s in text for s in ("favicon", "Failed to load resource", "Download the React DevTools")):
            return
        self.add("console", msg.type, text, tag=tag, url=msg.location.url if msg.location else "")

    def on_pageerror(self, tag, err: PWError):
        self.add("pageerror", "error", str(err), tag=tag)

    def on_response(self, tag, resp: Response):
        try:
            status = resp.status
        except Exception:
            return
        if status < 400:
            return
        url = resp.url
        path = urlparse(url).path
        # 静态资源 4xx 噪音
        if any(path.endswith(ext) for ext in (".js", ".css", ".png", ".jpg", ".svg", ".ico", ".woff2", ".woff")):
            return
        expected = self._is_expected(url, status)
        body = ""
        try:
            if status >= 500 or status in (409, 422):
                body = resp.text()[:500]
        except Exception:
            body = ""
        self.add(
            "http", "warning" if expected else "error",
            f"HTTP {status} {url}", tag=tag, status=status, expected=expected, body=body,
        )


class Harness:
    def __init__(self):
        self.findings = Findings()
        self._pw = None
        self.browser = None

    # ---- 生命周期 ----
    def start(self):
        cfg.ensure_artifacts()
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.launch(headless=cfg.HEADLESS, slow_mo=cfg.SLOW_MO, args=["--no-sandbox"])
        return self

    def stop(self):
        try:
            if self.browser:
                self.browser.close()
        finally:
            if self._pw:
                self._pw.stop()

    # ---- 上下文 ----
    def new_web_context(self):
        ctx = self.browser.new_context(viewport=cfg.WEB_VIEWPORT, locale="zh-CN")
        ctx.set_default_timeout(cfg.TIMEOUT)
        return ctx

    def new_mobile_context(self):
        ctx = self.browser.new_context(
            viewport=cfg.MOBILE_VIEWPORT, locale="zh-CN",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 "
                       "(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            is_mobile=True, has_touch=True,
        )
        ctx.set_default_timeout(cfg.TIMEOUT)
        return ctx

    def attach(self, page, tag):
        """给页面挂上被动捕获监听器。tag 用于区分来源（如 web/admin、mobile/visitor）。"""
        page.on("console", lambda m: self.findings.on_console(tag, m))
        page.on("pageerror", lambda e: self.findings.on_pageerror(tag, e))
        page.on("response", lambda r: self.findings.on_response(tag, r))

    def screenshot(self, page, name):
        try:
            path = os.path.join(cfg.ARTIFACTS_DIR, "screenshots", f"{name}.png")
            page.screenshot(path=path, full_page=True)
            return path
        except Exception:
            return None

    # ---- 健康检查（仅探活后端，不测业务）----
    def wait_backends_ready(self):
        import http.client
        for base, path in cfg.BACKEND_HEALTH.items():
            if not path:
                continue
            parsed = urlparse(base)
            host, port = parsed.hostname, parsed.port or 80
            deadline = time.time() + cfg.HEALTH_TIMEOUT
            last = ""
            while time.time() < deadline:
                try:
                    conn = http.client.HTTPConnection(host, port, timeout=3)
                    conn.request("GET", path)
                    r = conn.getresponse()
                    r.read()
                    conn.close()
                    if 200 <= r.status < 500:
                        break
                    last = f"status {r.status}"
                except Exception as e:
                    last = str(e)
                time.sleep(2)
            else:
                raise RuntimeError(f"后端 {base} 未就绪（{path}）：{last}")


# ============ 用例运行框架 ============
class TestRunner:
    def __init__(self, harness: Harness):
        self.h = harness
        self.results = []       # [{"id","name","status","error","duration","stage_idx","stage_name"}]
        self.cur_stage = None   # (idx, name) 当前阶段
        self.stage_order = []   # [(idx, name), ...] 已跑阶段（按序，供总报告分节）

    def set_stage(self, idx, name):
        """进入一个新阶段：盖戳当前阶段，并让被动捕获（HTTP/console）也能归属到本阶段。"""
        self.cur_stage = (idx, name)
        self.h.findings.current_stage = name
        if not self.stage_order or self.stage_order[-1][0] != idx:
            self.stage_order.append((idx, name))

    def run(self, tc_id, name, fn):
        stage_idx, stage_name = self.cur_stage or (0, "")
        print(f"\n===== [{tc_id}] {name} =====")
        start = time.time()
        rec = {"id": tc_id, "name": name, "status": "pass", "error": "", "duration": 0,
               "stage_idx": stage_idx, "stage_name": stage_name}
        try:
            fn(self.h)
            rec["status"] = "pass"
            print(f"[{tc_id}] 通过 ({time.time()-start:.1f}s)")
        except Exception as e:
            rec["status"] = "fail"
            rec["error"] = f"{e}\n{traceback.format_exc()}"
            self.h.findings.add("test-failure", "error", f"{tc_id} {name} 失败：{e}", tag=tc_id)
            print(f"[{tc_id}] 失败：{e}")
        finally:
            rec["duration"] = round(time.time() - start, 1)
            self.results.append(rec)
        return rec

    # ---- 阶段内结果过滤 ----
    def _stage_results(self, idx):
        return [r for r in self.results if r.get("stage_idx") == idx]

    def _stage_findings(self, name):
        """归属到本阶段的捕获项。被动捕获在测试执行期间触发，按 current_stage 盖戳。"""
        return [i for i in self.h.findings.items if i.get("stage") == name]

    # ---- 渲染：单个阶段的报告章节（阶段报告与总报告复用）----
    @staticmethod
    def _render_section(idx, name, results, findings, with_detail=True):
        total = len(results)
        passed = sum(1 for r in results if r["status"] == "pass")
        has_fail = total - passed > 0
        head = (f"## 阶段 {idx}：{name}  ❌ 有 {total-passed} 条失败"
                if has_fail else f"## 阶段 {idx}：{name}  ✅ 全部通过")
        lines = [head, "", f"- 用例：{total}  通过：{passed}  失败：{total-passed}", "",
                 "| 编号 | 用例 | 结果 | 耗时(s) |", "|---|---|---|---|"]
        for r in results:
            lines.append(f"| {r['id']} | {r['name']} | {'✅通过' if r['status']=='pass' else '❌失败'} | {r['duration']} |")
        unexpected = [i for i in findings if i.get("kind") == "http" and not i.get("expected")]
        pageerrs = [i for i in findings if i.get("kind") == "pageerror"]
        errors = [i for i in findings if i.get("severity") == "error"]
        lines += ["", "### 本阶段捕获的潜在问题", "",
                  f"- 意外 HTTP 4xx/5xx（可能 bug）：{len(unexpected)}",
                  f"- 控制台/页面错误：{len([e for e in errors if e.get('kind') in ('console','pageerror')]) + len(pageerrs)}",
                  f"- 页面未捕获异常：{len(pageerrs)}", ""]
        if unexpected:
            lines += ["| 状态 | URL | 来源 | 响应片段 |", "|---|---|---|---|"]
            for i in unexpected:
                lines.append(f"| {i.get('status')} | `{(i.get('message',''))[:100]}` | {i.get('tag','')} | {(i.get('body','') or '').replace('|','/')[:100]} |")
            lines.append("")
        if with_detail and has_fail:
            lines += ["### 本阶段失败详情", ""]
            for r in [x for x in results if x["status"] == "fail"]:
                lines += [f"#### {r['id']} {r['name']}", "```", r["error"][-3000:], "```", ""]
        return lines, has_fail

    # ---- 阶段报告 ----
    def write_stage_report(self, idx, name):
        results = self._stage_results(idx)
        findings = self._stage_findings(name)
        body, has_fail = self._render_section(idx, name, results, findings)
        md = os.path.join(cfg.REPORTS_DIR, f"stage_{idx:02d}.md")
        out = [f"# {REPORT_TITLE} — 阶段 {idx}：{name}", "",
               f"生成时间：{time.strftime('%Y-%m-%d %H:%M:%S')}", ""]
        out += body
        out += ["", "## 建议", "",
                ("- 本阶段有失败，建议先排查再继续下一阶段。" if has_fail
                 else "- 本阶段全部通过，可继续下一阶段。"), ""]
        with open(md, "w", encoding="utf-8") as f:
            f.write("\n".join(out))
        sj = os.path.join(cfg.REPORTS_DIR, f"stage_{idx:02d}.json")
        with open(sj, "w", encoding="utf-8") as f:
            json.dump({"stage_idx": idx, "stage_name": name, "results": results, "findings": findings},
                      f, ensure_ascii=False, indent=2)
        print(f"阶段 {idx} 报告：{md}")
        return has_fail

    # ---- 滚动总报告（每阶段后覆写，任何时候都是截至当前的全量快照）----
    def write_reports(self):
        fj = os.path.join(cfg.REPORTS_DIR, "findings.json")
        with open(fj, "w", encoding="utf-8") as f:
            json.dump({"results": self.results, "findings": self.h.findings.items, "state": state.all()}, f,
                      ensure_ascii=False, indent=2)
        md = os.path.join(cfg.REPORTS_DIR, "TEST_REPORT.md")
        total = len(self.results)
        passed = sum(1 for r in self.results if r["status"] == "pass")
        lines = [f"# {REPORT_TITLE}", "", f"生成时间：{time.strftime('%Y-%m-%d %H:%M:%S')}", "",
                 "## 总览", "", f"- 用例：{total}  通过：{passed}  失败：{total-passed}", ""]
        for idx, name in self.stage_order:                 # 已跑阶段各一节
            sec, _ = self._render_section(idx, name, self._stage_results(idx),
                                          self._stage_findings(name), with_detail=False)
            lines += ["", *sec]
        failed = [r for r in self.results if r["status"] == "fail"]
        if failed:
            lines += ["", "## 失败用例详情（汇总）", ""]
            for r in failed:
                lines += [f"### {r['id']} {r['name']}（阶段 {r.get('stage_idx')}：{r.get('stage_name')}）",
                          "```", r["error"][-3000:], "```", ""]
        lines += ["", "## 说明", "",
                  "- 「意外 HTTP 错误」中除标注「预期」外的 4xx/5xx 均需排查（可能是真实 bug）。",
                  "- 负向用例（如冲突 409、越权 4xx）已在代码中标记为预期，不计为 bug。",
                  "- 各阶段明细见 `reports/stage_NN.md`；失败截图见 `artifacts/screenshots/`；原始数据见 `reports/findings.json`。", ""]
        with open(md, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"总报告：{md}")
        print(f"原始数据：{fj}")

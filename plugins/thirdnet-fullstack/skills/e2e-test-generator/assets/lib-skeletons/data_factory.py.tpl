# -*- coding: utf-8 -*-
"""
测试数据工厂 —— 所有数据带前缀 + 运行标签，便于识别与清理、跨用例可复现。
核心：run_tag()（本批次唯一标签，写入 state）+ idx（每实体序号）→ 确定性唯一字符串。

【这是模板】保留 run_tag/_suffix 机制；下面每个实体函数按本项目实际主数据改写，
**字段名要和 ensure_xxx 在表单里填的 label 一一对应**（不是后端字段名，是 UI label）。
若某实体的 account/invite_code 等可由其它字段确定性推导（如 account=phone），
在这里就推导好，保证绑定类用例能复现（原则：确定性 > 随机）。
"""
import time

import config as cfg
from lib import state

_RUN_TAG = None


def run_tag():
    """本批次唯一标签（同一批用例共享），首次调用时写入 state。"""
    global _RUN_TAG
    if _RUN_TAG:
        return _RUN_TAG
    tag = state.get("run_tag")
    if not tag:
        tag = f"{int(time.time())}"
        state.set("run_tag", tag)
    _RUN_TAG = tag
    return tag


def _suffix(idx):
    return f"{run_tag()}{idx}"


# ============ 主数据（{{ADAPT}} 按项目实体改写）============
# 示例形状（参考）：每个函数返回一个 dict，键 = 表单 label 对应的值。
def entity_a(idx):
    name = f"{cfg.DATA_PREFIX}实体A_{_suffix(idx)}"
    return {
        "name": name,
        "code": f"CODE{_suffix(idx)}",
        # ...更多字段
    }


def some_child(parent_name, idx):
    return {"name": f"{cfg.DATA_PREFIX}子项_{_suffix(idx)}", "parent": parent_name}


def a_phone(idx):
    """确定性手机号（绑定类用例需要）。account/invite_code 可由它推导。"""
    return f"138{int(_suffix(idx)) % 10 ** 8:08d}"


# ============ 业务实体（{{ADAPT}}）============
def something(idx):
    return {"title": f"{cfg.DATA_PREFIX}业务项_{_suffix(idx)}", "content": "测试内容"}

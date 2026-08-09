# -*- coding: utf-8 -*-
"""
跨用例共享状态（run_state.json）。
scaffold 用例建好的「主数据 + 角色账号 + 绑定关系」写入此处，后续用例读取复用，
保证全链路数据真实一致、可复现。

【通用层】按原样拷贝即可，无需改动。
"""
import json
import os
import threading

_STATE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "run_state.json")
_lock = threading.Lock()
_cache = None


def _load():
    global _cache
    if _cache is not None:
        return _cache
    if os.path.exists(_STATE_PATH):
        with open(_STATE_PATH, "r", encoding="utf-8") as f:
            _cache = json.load(f)
    else:
        _cache = {}
    return _cache


def get(key, default=None):
    with _lock:
        return _load().get(key, default)


def set(key, value):
    with _lock:
        data = _load()
        data[key] = value
        _cache = data
        with open(_STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def update(mapping):
    with _lock:
        data = _load()
        data.update(mapping)
        _cache = data
        with open(_STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def all():
    with _lock:
        return dict(_load())


def clear():
    global _cache
    with _lock:
        _cache = {}
        if os.path.exists(_STATE_PATH):
            os.remove(_STATE_PATH)

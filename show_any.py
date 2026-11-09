import json
import reprlib


class AnyType(str):
    def __ne__(self, other):
        return False


ANY = AnyType("*")
MAX_CHARS = 30000


def describe(value, depth=0, seen=None):
    """Bounded inspection: never copy tensor data or enumerate arbitrary objects."""
    if seen is None:
        seen = set()
    if value is None or isinstance(value, (bool, int, float)):
        return repr(value)
    if isinstance(value, str):
        return value[:MAX_CHARS] + ("\n… [truncated]" if len(value) > MAX_CHARS else "")
    if isinstance(value, (bytes, bytearray)):
        return f"{type(value).__name__} ({len(value)} bytes): {repr(value[:128])}"
    kind = f"{type(value).__module__}.{type(value).__qualname__}"
    # Tensor/array metadata only. Avoid GPU synchronization and huge reprs.
    if type(value).__module__.split('.')[0] in ('torch', 'numpy') and hasattr(value, 'shape'):
        return f"{kind}\nshape: {tuple(value.shape)}\ndtype: {value.dtype}\ndevice: {getattr(value, 'device', 'CPU')}"
    if isinstance(value, (dict, list, tuple, set, frozenset)):
        if id(value) in seen:
            return '[circular reference]'
        if depth >= 4:
            return f'{kind} ({len(value)} items)'
        seen.add(id(value))
        try:
            lines = [f'{kind} ({len(value)} items)']
            entries = value.items() if isinstance(value, dict) else enumerate(value)
            size = 0
            for i, (key, item) in enumerate(entries):
                if i >= 50 or size >= MAX_CHARS:
                    lines.append('… [remaining items omitted]')
                    break
                label = reprlib.repr(key) if isinstance(value, dict) else str(key)
                text = describe(item, depth + 1, seen)
                line = f'{label}: ' + text.replace('\n', '\n  ')
                lines.append(line)
                size += len(line)
            return '\n'.join(lines)[:MAX_CHARS]
        finally:
            seen.remove(id(value))
    # Custom repr methods may perform expensive computation; only identify objects.
    return f'{kind}\n[object summary; internal data not expanded]'


class MagikShowAny:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'value': (ANY,)}}

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ('value',)
    FUNCTION = 'show'
    CATEGORY = 'Magik/Display'
    OUTPUT_NODE = True

    def show(self, value):
        try:
            text = describe(value)
        except Exception as exc:
            text = f'{type(value).__name__}\n[Cannot inspect: {type(exc).__name__}]'
        return {'ui': {'text': [text[:MAX_CHARS]]}, 'result': (value,)}

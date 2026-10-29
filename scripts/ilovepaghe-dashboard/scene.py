"""Motore delle tracce (Scene/Track) usato dalle animazioni di iLovePaghe.
Copiato senza modifiche da ilovepaghe-come-funziona/docs/come-funziona/animazioni.py (26 ottobre 2026):
ogni elemento ha una traccia di keyframe sullo stesso orologio; solo opacity e transform."""
import re
from urllib.parse import quote

EASE = 'cubic-bezier(.2,.7,.2,1)'          # the engine's --e-ease
EASE_OUT = 'cubic-bezier(.16,1,.3,1)'       # the dashboard's --ease-out
EASE_IO = 'cubic-bezier(.45,0,.55,1)'       # the engine's progress ease (in-out quad)
EASE_IN = 'cubic-bezier(.4,0,1,1)'
CHIP = 'cubic-bezier(.2,.9,.25,1)'          # the dropped PDF (motore-demo.css)
CAM = 'cubic-bezier(.65,0,.25,1)'
MOVE_X = 'cubic-bezier(.5,.02,.22,1)'
MOVE_Y = 'cubic-bezier(.32,.0,.16,1)'
ON, OFF = {'opacity': '1'}, {'opacity': '0'}


def num(v, nd=4):
    s = f'{v:.{nd}f}'.rstrip('0').rstrip('.')
    return s if s not in ('-0', '') else '0'


def pct(v):
    return num(v, 4) + '%'


def expand_units(css):
    """«12u» → calc(12*var(--u)); every scene defines its own --u."""
    return re.sub(r'(?<![\w.#%-])(-?(?:\d+\.\d+|\d+|\.\d+))u(?![\w-])',
                  lambda m: f'calc({m.group(1)}*var(--u))', css)


def eur(c):
    c = int(round(c))
    return f'{c // 100:,}'.replace(',', '.') + ',' + f'{c % 100:02d}'


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


EASE = 'cubic-bezier(.2,.7,.2,1)'          # the engine's --e-ease
EASE_OUT = 'cubic-bezier(.16,1,.3,1)'       # the dashboard's --ease-out
EASE_IO = 'cubic-bezier(.45,0,.55,1)'       # the engine's progress ease (in-out quad)
EASE_IN = 'cubic-bezier(.4,0,1,1)'
CHIP = 'cubic-bezier(.2,.9,.25,1)'          # the dropped PDF (motore-demo.css)
CAM = 'cubic-bezier(.65,0,.25,1)'
MOVE_X = 'cubic-bezier(.5,.02,.22,1)'
MOVE_Y = 'cubic-bezier(.32,.0,.16,1)'
ON, OFF = {'opacity': '1'}, {'opacity': '0'}


class Scene:
    """A timeline of T seconds; every track is one @keyframes on that clock."""

    def __init__(self, prefix, T, loop=True):
        self.prefix, self.T, self.loop = prefix, T, loop
        self.tracks = {}
        self.use = []          # (selector, track names)

    def tr(self, name, init, sel=None):
        t = Track(self, self.prefix + name, init)
        self.tracks[name] = t
        if sel:
            self.use.append((sel, [name]))
        return t

    def keyframes(self):
        return '\n'.join(t.css() for t in self.tracks.values())

    def merged(self):
        out = {}
        for sel, names in self.use:
            out.setdefault(sel, []).extend(names)
        return list(out.items())

    def bind(self, root, scope):
        """Resting state (first frame) and the animation rules."""
        it = 'infinite' if self.loop else '1 both'
        rest, run = [], []
        for sel, names in self.merged():
            init = {}
            for n in names:
                init.update(self.tracks[n].init)
            rest.append(f'{scope} {sel}{{' + ';'.join(f'{k}:{v}' for k, v in init.items()) + '}')
            anim = ', '.join(f'{self.tracks[n].name} {num(self.T)}s linear {it}' for n in names)
            run.append(f'{root} {sel}{{animation:{anim}}}')
        return rest, run

    def poster(self, t, scope):
        """Values at time t, for «Riduci movimento» (no animation, one meaningful frame)."""
        out = []
        for sel, names in self.merged():
            v = {}
            for n in names:
                v.update(self.tracks[n].value_at(t))
            out.append(f'{scope} {sel}{{animation:none!important;' + ';'.join(f'{k}:{val}' for k, val in v.items()) + '}')
        return out


class Track:
    def __init__(self, scene, name, init):
        self.scene, self.name = scene, name
        self.init = dict(init)
        self.keys = [[0.0, dict(init), None]]

    def at(self, t, vals=None, ease=None):
        last = self.keys[-1]
        assert t >= last[0] - 1e-9, (self.name, t, last[0])
        v = dict(last[1])
        v.update(vals or {})
        if abs(t - last[0]) < 1e-9:
            last[1] = v
            if ease:
                last[2] = ease
        else:
            self.keys.append([t, v, ease])
        return self

    def go(self, t0, t1, vals, ease=EASE):
        self.at(t0, None, ease)
        self.at(t1, vals)
        return self

    def step(self, t, vals, d=0.012):
        return self.go(t, t + d, vals, 'linear')

    def value_at(self, t):
        cur = self.keys[0][1]
        for kt, v, _ in self.keys:
            if kt <= t + 1e-9:
                cur = v
        return cur

    def css(self):
        T = self.scene.T
        keys = [list(k) for k in self.keys]
        assert keys[-1][0] <= T + 1e-9, (self.name, keys[-1][0], T)
        if self.scene.loop:
            assert keys[-1][1] == self.init, ('loop not closed', self.name, keys[-1][1], self.init)
            if keys[-1][0] < T - 1e-9:
                keys.append([T, dict(self.init), None])
        elif keys[-1][0] < T - 1e-9:
            keys.append([T, dict(keys[-1][1]), None])
        groups = []
        for t, v, e in keys:
            if groups and groups[-1][1] == v:
                groups[-1][0].append(t)
                groups[-1][2] = e
            else:
                groups.append([[t], v, e])
        rows = []
        for ts, v, e in groups:
            body = ';'.join(f'{p}:{val}' for p, val in v.items())
            if e and e != 'linear' and ts[-1] < T - 1e-9:
                body += f';animation-timing-function:{e}'
            rows.append('  ' + ','.join(f'{num(t / T * 100, 3)}%' for t in ts) + f'{{{body}}}')
        return f'@keyframes {self.name}{{\n' + '\n'.join(rows) + '\n}'

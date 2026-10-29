#!/usr/bin/env python3
"""La dashboard di iLovePaghe, ricostruita e animata per la homepage di LG Trading.

Fonte: demo pubblica https://www.ilovepaghe.com/landing/demo/dashboard.html (Aurora Studio S.r.l.),
letta il 29 ottobre 2026 a 1440 x 900: markup, regole CSS effettivamente usate, variabili e dati.
Solo HTML e CSS: ogni lunghezza è N * --u (--u = larghezza del riquadro / 1440), quindi lo schermo
intero scala con il riquadro; si animano solo opacity e transform, con lo stesso orologio per tutte
le tracce. Il motore delle tracce (Scene/Track) è quello di ilovepaghe-come-funziona/animazioni.py.

Uso, dalla cartella del progetto:
      python3 scripts/ilovepaghe-dashboard/build_dashboard.py
      → scrive public/ilovepaghe-demo.css, public/ilovepaghe-demo-static.css e il markup fra
        <!-- demo:inizio --> e <!-- demo:fine --> in public/index.html
      source.css contiene le regole della demo pubblica effettivamente usate dalla dashboard
      (lette nel browser a 1440 x 900); il generatore le limita a .ilpd e porta i px in --u.
"""
import re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from scene import Scene, num, pct, EASE, EASE_OUT, EASE_IO, CAM, ON, OFF  # noqa: E402

PUBLIC = HERE.parents[1] / 'public'
W, H = 1440, 900
SCROLL = 511          # dashScroller 1411 px alto, finestra 900 px
ROOT, SCOPE = '.ilpd.isVisible', '.ilpd'

# ------------------------------------------------------------------------------------------- CSS
def u(v):
    v = float(v)
    if v == 0:
        return '0'
    return f'calc({num(v)}*var(--u))'


def to_units(css):
    css = css.replace('100dvh', f'{H}px')
    return re.sub(r'(?<![\w.#-])(-?\d*\.?\d+)px', lambda m: u(m.group(1)), css)


HEADINGS = '.homeTitle,.homeHeroTitle,.homeKpiLabel,.homeSectionTitle,.homeAppTitle'


def scope_selector(sel):
    sel = sel.strip()
    if sel in (':root', 'body'):
        return '.ilpdScreen'
    if sel in ('*', '::before', '::after'):
        return '.ilpd ' + sel
    if sel in ('h1', 'h2'):
        return f'.ilpd :is({HEADINGS})'
    sel = sel.replace('#adminContentRoot > main', '.adminContentRoot > .dashPage').replace('#adminContentRoot', '.adminContentRoot')
    sel = sel.replace('.dashQuickForm textarea', '.dashQuickForm .dashQuickArea')
    if sel in ('textarea',):
        return '.ilpd .dashQuickArea'
    if sel.startswith('button,textarea'):
        return sel
    return '.ilpd ' + sel


def scoped_css():
    out = []
    for line in (HERE / 'source.css').read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith('@keyframes'):
            out.append(to_units(line))
            continue
        sel, body = line.split('{', 1)
        if sel.strip() == 'button,textarea':
            sels = ['.ilpd button', '.ilpd .dashQuickArea']
        else:
            sels = [scope_selector(s) for s in sel.split(',')]
            sels = list(dict.fromkeys(sels))
        out.append(','.join(sels) + '{' + to_units(body))
    return '\n'.join(out)


# ------------------------------------------------------------------------------------------ HTML
def svg(body, sw='1.8', w=None, cls=None):
    a = f' class="{cls}"' if cls else ''
    size = f' height="{w}" width="{w}"' if w else ''
    return (f'<svg{a} fill="none"{size} stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" '
            f'stroke-width="{sw}" viewBox="0 0 24 24">{body}</svg>')


I = {  # icone della dashboard, come nel markup della demo
    'home': '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19Z"></path>',
    'stats': '<path d="M4 4v16h16"></path><path d="M8 15v-3M12.5 15V8M17 15v-5"></path>',
    'people': '<circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 19.5v-1a5.5 5.5 0 0 1 11 0v1"></path><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M17.5 14a5 5 0 0 1 3 4.6v.9"></path>',
    'clock': '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
    'cal': '<rect height="15.5" rx="2.5" width="17" x="3.5" y="5"></rect><path d="M8 3v4M16 3v4M3.5 10h17"></path>',
    'chat': '<path d="M5.5 5h13A2.5 2.5 0 0 1 21 7.5v7.5a2.5 2.5 0 0 1-2.5 2.5H10l-5 3.5v-3.5A2.5 2.5 0 0 1 3 15V7.5A2.5 2.5 0 0 1 5.5 5Z"></path><path d="M8 10h8M8 13.5h5"></path>',
    'upload': '<path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"></path><path d="M8 8.5 12 4.5l4 4M12 4.5V15"></path>',
    'ext': '<path d="M8 16 16 8M9.5 8H16v6.5"></path>',
    'settings': '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"></path><circle cx="16" cy="6" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="18" cy="18" r="2"></circle>',
    'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>',
    'search': '<path d="m20 20-4.2-4.2"></path><circle cx="11" cy="11" r="6.5"></circle>',
    'monitor': '<rect height="12.5" rx="2" width="18" x="3" y="4.5"></rect><path d="M8.5 20.5h7M12 17v3.5"></path>',
    'sun': '<circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"></path>',
    'moon': '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"></path>',
    'back': '<path d="M14.5 6 8.5 12l6 6"></path>',
    'exit': '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"></path><path d="M10 8l-4 4 4 4M6 12h10"></path>',
    'useradd': '<circle cx="10" cy="8" r="3.4"></circle><path d="M3.5 19.5v-.8a6 6 0 0 1 9.6-4.8M18 14v6M15 17h6"></path>',
    'entry': '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M3 12h12M10 7l5 5-5 5"></path>',
    'chevd': '<path d="m7 10 5 5 5-5"></path>',
    'calfoot': '<rect height="15" rx="3" width="16" x="4" y="5"></rect><path d="M8 3v4m8-4v4M4 11h16"></path>',
    'calok': '<rect height="15" rx="3" width="16" x="4" y="5"></rect><path d="M8 3v4m8-4v4M4 11h16M9 15.5l2 2 4-4"></path>',
    'chevr': '<path d="M9.5 6l6 6-6 6"></path>',
    'doc': '<path d="M14 3H6v18h12V7l-4-4Zm0 0v5h5"></path><path d="M9 13h6M9 17h4"></path>',
    'calev': '<rect height="15" rx="3" width="16" x="4" y="5"></rect><path d="M8 3v4m8-4v4M4 11h16m-10 4h4"></path>',
    'entryev': '<path d="M13 5h5v14h-5M3 12h11m-4-4 4 4-4 4"></path>',
    'phone': '<rect height="19" rx="2.6" width="11" x="6.5" y="2.5"></rect><path d="M10.5 18.5h3"></path>',
}


def nav(icon, label, extra='', active=False):
    cls = 'navItem navItemActive' if active else 'navItem'
    return (f'<a class="{cls}">{svg(I[icon], w=20, cls="navIcon")}<span class="navLabel">{label}</span>{extra}</a>')


def sidebar():
    seg = lambda icon, on: f'<button aria-pressed="{"true" if on else "false"}" type="button">{svg(I[icon], w=15)}</button>'
    return (
        '<aside class="sideNav"><div class="sideTop"><a class="sideBrand"><img alt="" height="26" src="/ilp-logo-square.png" width="26"><span>iLovePaghe</span></a></div>'
        '<div class="sideCompanyPanel"><div class="sideCompanyIcon sideCompanyAvatar">AS</div><div class="sideCompanyText">'
        '<div class="sideCompanyName">Aurora Studio S.r.l.</div><div class="sideAccountEmail">amministrazione@aurorastudio-srl.it</div></div></div>'
        f'<button class="sideSearch" type="button">{svg(I["search"])}<span>Cerca</span><span class="uiKbd">Ctrl K</span></button>'
        '<nav class="sideMenu">'
        + nav('home', 'Dashboard', active=True) + nav('stats', 'Statistiche')
        + '<div class="sideGroupLabel">Persone</div>'
        + nav('people', 'Dipendenti') + nav('clock', 'Timbrature') + nav('cal', 'Permessi e assenze', '<span class="navBadge">3</span>')
        + '<div class="sideGroupLabel">Strumenti</div>'
        + nav('chat', 'Comunicazioni') + nav('upload', 'Carica cedolini', svg(I['ext'], cls='navExternal'))
        + '<div class="sideGroupLabel">Account</div>'
        + nav('settings', 'Impostazioni') + nav('link', 'Ambassador')
        + '</nav><div class="sideSpacer"></div><div class="sideFooter"><div class="sideThemeRow"><span>Tema</span><div><div class="uiSegmented">'
        + seg('monitor', True) + seg('sun', False) + seg('moon', False)
        + f'</div></div></div><a class="sideBack">{svg(I["back"], w=20, cls="navIcon")}<span>Torna al sito</span></a>'
        f'<button class="sideBack" type="button">{svg(I["exit"], w=20, cls="navIcon")}<span>Esci</span></button></div></aside>')


PRESENT = [('Gatti Matteo', 'GM', 220, 16, '09:08'), ('Marini Diego', 'MD', 14, 72, '09:07'),
           ('Ricci Martina', 'RM', 214, 78, '09:07'), ('De Santis Alice', 'DS', 36, 82, '09:06'),
           ('Marino Cristina', 'MC', 182, 64, '09:06'), ('Mazza Federico', 'MF', 14, 72, '09:05')]
PENDING = [('De Luca Davide', 'Permesso · 23 ott, 14–18'), ('Conte Luca', 'Assenza · 2–6 nov'),
           ('Sanna Leonardo', 'Permesso · 27 ott, 9–11')]
EVENTS = [('absence', 'calev', 'De Luca Davide', 'Permesso richiesto', '09:12'),
          ('in', 'entryev', 'Gatti Matteo', 'Entrata · Via dell’Industria 4, Cerea', '09:08'),
          ('in', 'entryev', 'Ricci Martina', 'Entrata · Via dell’Industria 4, Cerea', '09:07'),
          ('in', 'entryev', 'Marini Diego', 'Entrata · Via dell’Industria 4, Cerea', '09:07'),
          ('in', 'entryev', 'Marino Cristina', 'Entrata · Via dell’Industria 4, Cerea', '09:06')]
BARS = [(10.69, 89.31, 8.80), (9.87, 90.13, 48.80), (8.72, 91.28, 88.80), (8.00, 92.00, 128.80), (9.37, 90.63, 168.80), (8.58, 91.42, 208.80)]
PAYROLL = '148.431,41 €'
ON_CELLS, CELLS = 78, 83

# contatori: colonne di valori che scorrono con steps(), come nel motore
COUNT_HERO = [0, 4, 9, 15, 22, 30, 38, 46, 53, 60, 66, 71, 75, 77, 78]
COUNT_TEAM = [0, 14, 29, 43, 56, 67, 75, 80, 82, 83]
COUNT_PEND = [0, 1, 2, 3]


def strip(cls, values):
    """Finestra di una riga; il valore finale (l'ultimo) dà la misura alla finestra."""
    lines = ''.join(f'<span>{v}</span>' for v in values)
    return f'<span class="ilpdWin {cls}"><span class="ilpdGhost">{values[-1]}</span><span class="ilpdStr">{lines}</span></span>'


def odometer(text):
    out, k = [], 0
    for ch in text:
        if ch.isdigit():
            k += 1
            col = ''.join(f'<span>{d % 10}</span>' for d in range(20))
            out.append(f'<span class="ilpdOdo ilpdOdo{k}"><span class="ilpdGhost">{ch}</span><span class="ilpdStr">{col}</span></span>')
        else:
            out.append(f'<span class="ilpdOdoC">{"&nbsp;" if ch == " " else ch}</span>')
    return ''.join(out), k


def main():
    cells = ''.join('<i class="isOn"></i>' if k < ON_CELLS else '<i></i>' for k in range(CELLS))
    people = ''.join(
        f'<div class="dashPresenceItem"><div class="dashPresenceIdentity"><span class="dashPresenceAvatar" style="--av-h:{h};--av-s:{s}%">{ini}</span>'
        f'<div class="dashPresenceName">{name}</div></div><time class="dashPresenceTime">{svg(I["entry"], "2")} {t} </time></div>'
        for name, ini, h, s, t in PRESENT)
    pending = ''.join(f'<li><strong>{n}</strong><span>{d}</span></li>' for n, d in PENDING)
    events = ''.join(
        f'<li class="dashEvent" data-event-kind="{kind}"><span class="dashEventIcon">{svg(I[icon], "1.7")}</span>'
        f'<div class="dashEventCopy"><strong>{name}</strong><span>{what}</span></div><time><b>{t}</b><small>20 ott 2026</small></time></li>'
        for kind, icon, name, what, t in EVENTS)
    bars = ''.join(f'<rect class="dashTrendBar{" isSelected" if k == 5 else ""}" height="{h:.2f}" rx="3" width="22.40" x="{x:.2f}" y="{y:.2f}"></rect>'
                   for k, (y, h, x) in enumerate(BARS))
    odo, _ = odometer(PAYROLL)
    months = ''.join(f'<li{" class=\"isSelected\"" if m == "set" else ""}>{m}</li>' for m in ['apr', 'mag', 'giu', 'lug', 'ago', 'set'])
    return (
        '<div class="adminContentRoot"><main class="dashPage"><div class="ilpdScroll"><div class="uiPage homePage">'
        '<header class="homeHead"><div class="homeHeadText"><p class="homeDate">martedì 20 ottobre 2026</p><div class="homeTitle">Aurora Studio S.r.l.</div></div>'
        f'<div class="uiPageActions homeActions"><button class="uiBtn uiBtn--secondary" type="button">{svg(I["useradd"])}<span>Aggiungi dipendente</span></button>'
        f'<a class="uiBtn uiBtn--primary">{svg(I["upload"])}<span>Carica buste paga</span></a></div></header>'
        # In servizio adesso
        '<section class="homeHero dashCardPresence"><div class="homeHeroTop"><div class="homeHeroTitle"><span class="homeLiveDot"></span>In servizio adesso</div>'
        '<p class="homeHeroUpdated">Aggiornato alle <b>10:24</b></p></div><div class="homeHeroBody"><div class="homeHeroFigure">'
        f'<p class="homeHeroCount"><span class="homeHeroNumber homeBig">{strip("ilpdCountHero", COUNT_HERO)}</span><span class="homeHeroOf">su <b>83</b> dipendenti</span></p>'
        f'<div class="homeHeroGrid" data-mode="cells">{cells}</div>'
        '<p class="homeHeroCoverage"><b>94%</b> del personale in servizio</p></div>'
        f'<div class="homeHeroPeople"><div class="homePresenceList dashPresenceList">{people}'
        f'<button class="dashPresenceMore" type="button"><span>Mostra tutti (78)</span>{svg(I["chevd"])}</button></div></div></div>'
        f'<div class="homeHeroFoot"><span class="homeHeroFootIcon">{svg(I["calfoot"])}</span><span class="homeHeroFootLabel">In permesso o assenza oggi</span>'
        '<span class="homeHeroFootValue">Galli Massimo, Pellegrini Tommaso, Russo Francesco</span></div></section>'
        # le tre schede
        '<section class="homeKpis">'
        f'<article class="homeKpi homeKpiPending isActive"><div class="homeKpiHead"><span class="homeKpiIcon">{svg(I["calok"])}</span><div class="homeKpiLabel">Richieste da valutare</div></div>'
        f'<div class="homeKpiValue">{strip("ilpdCountPend", COUNT_PEND)}</div><p class="homeKpiNote">Attendono la tua decisione:</p><ul class="homePendingList">{pending}</ul>'
        f'<button class="homeKpiAction" type="button"><span>Valuta le richieste</span>{svg(I["chevr"], "2")}</button></article>'
        f'<article class="homeKpi homeKpiTeam"><div class="homeKpiHead"><span class="homeKpiIcon">{svg(I["people"])}</span><div class="homeKpiLabel">Dipendenti</div></div>'
        f'<div class="homeKpiValue homeStatValue">{strip("ilpdCountTeam", COUNT_TEAM)}</div><div class="homeSplit"><div class="homeSplitBar"><i data-ui-split="with" style="flex-grow: 83;"></i></div>'
        '<ul class="homeLegend"><li><span class="homeSwatch homeSwatch--ink"></span><b>83</b> con email</li><li><span class="homeSwatch homeSwatch--amber"></span><b>0</b> senza email</li></ul></div>'
        '<p class="homeKpiRow"><span>Con il cedolino di <span class="homeKpiMonth">settembre 2026</span></span><b>83 di 83</b></p>'
        f'<div class="homeKpiLinks"><button class="homeKpiAction" type="button"><span>Vedi elenco</span>{svg(I["chevr"], "2")}</button></div></article>'
        f'<article class="homeKpi homeKpiPayroll"><div class="homeKpiHead"><span class="homeKpiIcon">{svg(I["doc"])}</span><div class="homeKpiLabel">Retribuzioni nette</div>'
        '<span class="homeKpiPeriod">Settembre 2026</span></div>'
        f'<div class="homeKpiValue homeStatValue">{odo}</div>'
        f'<div class="dashPayrollTrend"><svg preserveAspectRatio="none" viewBox="0 0 240 100"><g>{bars}</g></svg><ol class="dashTrendMonths">{months}</ol></div></article></section>'
        # attività, messaggio, modalità
        '<div class="homeGrid"><section class="homePanel dashEventsCard"><div class="homePanelHead"><div class="homeSectionTitle">Attività recente</div>'
        f'<span class="dashEventsAttribution">Indirizzi: Google Maps</span></div><ol class="dashEventsList">{events}</ol></section>'
        '<div class="homeSide"><section class="homePanel dashQuickCommunicationCard"><div class="homePanelHead"><div class="homeSectionTitle">Messaggio a tutto il personale</div></div>'
        '<div class="dashQuickForm"><div class="dashQuickArea">Scrivi un avviso per tutti i dipendenti…</div><div class="dashQuickFoot">'
        '<p class="dashQuickHelp">Arriva come notifica nell’app. Per singoli dipendenti usa <a>Comunicazioni</a>.</p>'
        '<button class="uiBtn uiBtn--primary uiBtn--sm" type="button">Invia a tutti</button></div></div></section>'
        f'<section class="homePanel homeModes dashGpsCard"><div class="homePanelHead"><div class="homeSectionTitle">Modalità di timbratura</div><a class="homePanelLink">Gestisci {svg(I["chevr"], "2")}</a></div>'
        '<div class="homeSplitBar homeSplitBar--modes"><i data-mode="gps" style="flex-grow: 83;"></i></div><ul class="homeModesList">'
        '<li data-mode="gps"><span class="homeSwatch homeSwatch--blue"></span><span class="homeModeName">GPS</span><b>83</b></li>'
        '<li class="isZero" data-mode="qr"><span class="homeSwatch homeSwatch--ink"></span><span class="homeModeName">QR aziendale</span><b>0</b></li>'
        '<li class="isZero" data-mode="direct"><span class="homeSwatch homeSwatch--green"></span><span class="homeModeName">Diretta</span><b>0</b></li>'
        '<li class="isZero" data-mode="off"><span class="homeSwatch homeSwatch--slate"></span><span class="homeModeName">Disattivata</span><b>0</b></li></ul></section></div></div>'
        f'<section class="homePanel homeAppPanel dashAppCard"><span class="homeAppMark">{svg(I["phone"])}</span><div class="homeAppCopy"><div class="homeAppTitle">L’app per i tuoi dipendenti</div>'
        '<p class="homeAppText">Cedolini, timbrature e richieste di permesso dal telefono.</p></div><div class="dashAppStores">'
        '<a class="dashAppStoreBadge apple"><img alt="" height="800" src="/ilp-app-store.svg" width="800"></a>'
        '<a class="dashAppStoreBadge google"><img alt="" height="800" src="/ilp-google-play.svg" width="800"></a></div></section>'
        '</div></div></main></div>')


RAIL = [('Presenze', 'Chi è in servizio adesso'), ('Richieste', 'Permessi e assenze da valutare'),
        ('Dipendenti', 'Email e cedolini del mese'), ('Retribuzioni', 'Il netto e gli ultimi sei mesi'),
        ('Attività', 'Entrate e richieste recenti')]

LABEL = ('La dashboard di iLovePaghe, animata, con l’azienda di esempio Aurora Studio S.r.l.: 78 dipendenti in servizio su 83, '
         'le ultime entrate, 3 richieste di permesso o assenza da valutare, 83 dipendenti tutti con l’email e con il cedolino di settembre, '
         'retribuzioni nette di settembre 2026 per 148.431,41 euro con l’andamento degli ultimi sei mesi, poi l’attività recente '
         'e le modalità di timbratura.')


def neutral(markup):
    """Landmark e sezioni diventano div: la dashboard è un'immagine, non deve entrare nella struttura della pagina."""
    for tag in ('main', 'aside', 'nav', 'section', 'article', 'header'):
        markup = re.sub(rf'<{tag}(\s|>)', r'<div\1', markup)
        markup = markup.replace(f'</{tag}>', '</div>')
    return markup


def html():
    rail = ''.join(f'<li><span class="ilpdRailN"><b>{k}</b><i>{k}</i></span><span><b>{t}</b><span>{d}</span></span></li>'
                   for k, (t, d) in enumerate(RAIL, 1))
    return (
        '<div class="ilpd" id="ilovepaghe-demo" data-nosnippet>\n'
        '      <div class="ilpdStage">\n'
        '        <figure class="ilpdFrame">\n'
        f'          <div class="ilpdScreen" role="img" aria-label="{LABEL}">'
        f'<div class="ilpdCam" aria-hidden="true" inert><div class="pageShell">{neutral(sidebar() + main())}</div></div></div>\n'
        '        </figure>\n'
        '      </div>\n'
        f'      <ol class="ilpdRail" aria-label="Cosa mostra la dashboard">{rail}</ol>\n'
        '      <p class="ilpdCaption">La dashboard di iLovePaghe come nella demo pubblica, con l’azienda di esempio Aurora Studio S.r.l. '
        'Nomi, importi e orari sono di prova. <a href="https://www.ilovepaghe.com/landing/demo/dashboard.html" target="_blank" rel="noopener">'
        'Provate la demo<span class="sr-only"> (si apre in una nuova scheda)</span></a></p>\n'
        '    </div>')


# ------------------------------------------------------------------------------------- the scene
T = 15.9
P_A, P_B, P_C, P_D = 0.6, 3.3, 4.3, 5.4           # presenze, richieste, dipendenti, retribuzioni
P_E0, P_E1 = 7.6, 8.8                              # scorrimento verso «Attività recente»
P_F0, P_F1 = 11.4, 12.6                            # ritorno in cima
R = 15.0                                           # dissolvenza e ripartenza
PHASES = [(P_A, P_B), (P_B, P_C), (P_C, P_D), (P_D, 7.1), (P_E0, P_F0)]
POSTER = 13.6

RISE = {'opacity': '0', 'transform': f'translateY({u(14)})'}
UP = {'opacity': '1', 'transform': 'translateY(0)'}
HIDE_L = {'opacity': '0', 'transform': f'translateX({u(-10)})'}
SHOW_L = {'opacity': '1', 'transform': 'translateX(0)'}


def scene():
    sc = Scene('ilpd', T)
    tr = sc.tr

    def card(name, sel, t):
        tr(name, RISE, sel).go(t, t + 0.7, UP, EASE_OUT).go(R, R + 0.4, {'opacity': '0'}).step(R + 0.45, RISE)

    def fade(name, sel, t, d=0.4, init=OFF):
        tr(name, init, sel).go(t, t + d, ON).step(R + 0.45, init)

    def item(name, sel, t):
        tr(name, HIDE_L, sel).go(t, t + 0.45, SHOW_L, EASE_OUT).step(R + 0.45, HIDE_L)

    def count(name, sel, values, t0, t1):
        n = len(values) - 1
        tr(name, {'transform': 'translateY(0%)'}, sel) \
            .go(t0, t1, {'transform': f'translateY({pct(-100 * n / (n + 1))})'}, f'steps({n}, end)') \
            .step(R + 0.45, {'transform': 'translateY(0%)'})

    # le schede entrano una dopo l'altra
    card('Hero', '.homeHero', 0.15)
    for k, t in enumerate((0.35, 0.47, 0.59), 1):
        card(f'Kpi{k}', f'.homeKpis > :nth-child({k})', t)
    card('Events', '.dashEventsCard', 0.7)
    card('Side1', '.homeSide > :nth-child(1)', 0.8)
    card('Side2', '.homeSide > :nth-child(2)', 0.9)
    card('App', '.dashAppCard', 1.0)

    # A. In servizio adesso: il contatore, la griglia, le ultime entrate
    count('CountHero', '.ilpdCountHero .ilpdStr', COUNT_HERO, P_A + 0.15, P_A + 1.6)
    t0, t1 = P_A + 0.15, P_A + 1.6
    for k in range(ON_CELLS):
        t = t0 + (t1 - t0 - 0.2) * k / (ON_CELLS - 1)
        tr(f'Cell{k + 1}', OFF, f'.homeHeroGrid > i:nth-child({k + 1})::after').go(t, t + 0.22, ON).step(R + 0.45, OFF)
    fade('Coverage', '.homeHeroCoverage', P_A + 1.55)
    fade('Of', '.homeHeroOf', P_A + 0.2)
    for k in range(len(PRESENT)):
        item(f'Pres{k + 1}', f'.dashPresenceItem:nth-child({k + 1})', P_A + 1.4 + 0.14 * k)
    fade('More', '.dashPresenceMore', P_A + 2.2)
    fade('Foot', '.homeHeroFoot', P_A + 2.3)

    # B. Richieste da valutare
    fade('PendVal', '.homeKpiPending .homeKpiValue', P_B, 0.25)
    count('CountPend', '.ilpdCountPend .ilpdStr', COUNT_PEND, P_B + 0.05, P_B + 0.5)
    fade('PendNote', '.homeKpiPending .homeKpiNote', P_B + 0.1)
    for k in range(len(PENDING)):
        item(f'Pend{k + 1}', f'.homePendingList li:nth-child({k + 1})', P_B + 0.25 + 0.14 * k)
    fade('PendAct', '.homeKpiPending .homeKpiAction', P_B + 0.75)

    # C. Dipendenti: il numero, la barra delle email, il cedolino
    fade('TeamVal', '.homeKpiTeam .homeKpiValue', P_C, 0.25)
    count('CountTeam', '.ilpdCountTeam .ilpdStr', COUNT_TEAM, P_C + 0.05, P_C + 0.8)
    tr('TeamBar', {'transform': 'scaleX(0)'}, '.homeKpiTeam .homeSplitBar > i') \
        .go(P_C + 0.1, P_C + 0.9, {'transform': 'scaleX(1)'}, EASE_OUT).step(R + 0.45, {'transform': 'scaleX(0)'})
    fade('Legend', '.homeLegend', P_C + 0.6)
    fade('TeamRow', '.homeKpiTeam .homeKpiRow', P_C + 0.75)
    fade('TeamLinks', '.homeKpiTeam .homeKpiLinks', P_C + 0.9)

    # D. Retribuzioni nette: le cifre girano, le barre crescono
    fade('PayVal', '.homeKpiPayroll .homeKpiValue', P_D, 0.25)
    odo_digits = sum(ch.isdigit() for ch in PAYROLL)
    k = 0
    for ch in PAYROLL:
        if not ch.isdigit():
            continue
        k += 1
        d = int(ch)
        end = P_D + 0.7 + 0.11 * k
        tr(f'Odo{k}', {'transform': 'translateY(0%)'}, f'.ilpdOdo{k} .ilpdStr') \
            .go(P_D + 0.05, end, {'transform': f'translateY({pct(-100 * (10 + d) / 20)})'}, 'cubic-bezier(.3,.2,.1,1)') \
            .step(R + 0.45, {'transform': 'translateY(0%)'})
    assert k == odo_digits
    for j in range(6):
        tr(f'Bar{j + 1}', {'transform': 'scaleY(0)'}, f'.dashTrendBar:nth-child({j + 1})') \
            .go(P_D + 0.25 + 0.1 * j, P_D + 0.95 + 0.1 * j, {'transform': 'scaleY(1)'}, EASE_OUT) \
            .step(R + 0.45, {'transform': 'scaleY(0)'})
    fade('Months', '.dashTrendMonths', P_D + 0.4)

    # E. scorrimento verso «Attività recente», poi ritorno in cima
    up = {'transform': f'translateY({u(-SCROLL)})'}
    tr('Scroll', {'transform': 'translateY(0)'}, '.ilpdScroll') \
        .go(P_E0, P_E1, up, CAM).go(P_F0, P_F1, {'transform': 'translateY(0)'}, CAM)
    for k in range(len(EVENTS)):
        item(f'Ev{k + 1}', f'.dashEvent:nth-child({k + 1})', P_E0 + 0.75 + 0.13 * k)
    tr('ModesBar', {'transform': 'scaleX(0)'}, '.homeModes .homeSplitBar > i') \
        .go(P_E0 + 0.9, P_E0 + 1.7, {'transform': 'scaleX(1)'}, EASE_OUT).step(R + 0.45, {'transform': 'scaleX(0)'})

    # i cinque passaggi sotto lo schermo, accesi in sincrono
    for k, (a, b) in enumerate(PHASES, 1):
        li = f'.ilpdRail li:nth-child({k})'
        bar = tr(f'Rail{k}Bar', {'transform': 'scaleX(0)'}, f'{li}::before')
        bar.at(a, None, 'linear').at(b, {'transform': 'scaleX(1)'}).go(R, R + 0.4, {'transform': 'scaleX(0)'}, EASE)
        tr(f'Rail{k}On', OFF, f'{li} .ilpdRailN i').step(a, ON, 0.15).step(b, OFF, 0.15)
        tr(f'Rail{k}Ok', OFF, f'{li} .ilpdRailN::after').go(b, b + 0.25, ON).go(R, R + 0.4, OFF)
    return sc


def cam_tf(s, fx, fy, view_h, base):
    tx = min(0, max(W - W * s, W / 2 - s * fx))
    ty = min(0, max(view_h - H * s, view_h / 2 - s * fy))
    return f'translate({pct(tx / (W * base) * 100)},{pct(ty / (H * base) * 100)}) scale({num(s / base)})'


# camera sui riquadri stretti: (inizio, fine, fuoco x, fuoco y) sulle coordinate dello schermo 1440 x 900
CAM_T = [(0, 0, 720, 330), (P_B - 0.2, P_B + 0.4, 520, 640), (P_D - 0.2, P_D + 0.5, 1060, 640),
         (P_E0, P_E1, 720, 520), (P_F0, P_F1, 720, 330)]
CAM_M = [(0, 0, 548, 300), (P_A + 1.5, P_A + 2.1, 1100, 290), (P_B - 0.15, P_B + 0.45, 470, 640),
         (P_C - 0.15, P_C + 0.45, 805, 640), (P_D - 0.15, P_D + 0.45, 1190, 640), (P_E0, P_E1, 630, 520),
         (P_E1 + 1.2, P_E1 + 2.0, 1185, 470), (P_F0, P_F1, 548, 300)]
TIERS = [(900, 1.5, (4, 3), 'CamT', CAM_T), (600, 2.35, (4, 5), 'CamM', CAM_M)]


STATIC = '''
/* =====================================================================
   iLovePaghe — la dashboard animata nella homepage di LG Trading.
   Ricostruita dalla demo pubblica (ilovepaghe.com/landing/demo/dashboard.html, Aurora Studio S.r.l.):
   stesse regole CSS, variabili e dati, con ogni lunghezza in --u. Generato da build_dashboard.py.
   Solo opacity e transform; ciclo di {T} s.
   ===================================================================== */
.ilpd{{--ilpd-ink:#0d0d0d;--ilpd-line:#e5e5e7;--ilpd-text-2:#55555b;--ilpd-text-3:#6e6e74;--ilpd-green:#3f9a6a}}
.ilpdStage{{position:relative;isolation:isolate;overflow:hidden;padding:clamp(12px,3.6vw,52px) clamp(12px,4.4vw,64px) 0;border-radius:clamp(20px,2.6vw,36px);
  background:radial-gradient(60% 70% at 50% 100%,rgba(28,111,230,.42),transparent 70%),radial-gradient(40% 50% at 12% 0%,rgba(120,160,255,.14),transparent 70%),#0d0d0d}}
.ilpdStage::before{{content:"";position:absolute;inset:0;z-index:-1;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);
  background-size:44px 44px;-webkit-mask-image:linear-gradient(180deg,#000 0%,transparent 85%);mask-image:linear-gradient(180deg,#000 0%,transparent 85%)}}
.ilpdFrame{{position:relative;overflow:hidden;margin:0;border-radius:clamp(10px,1.2vw,16px) clamp(10px,1.2vw,16px) 0 0;background:#fff;
  box-shadow:0 0 0 1px rgba(255,255,255,.12),0 -20px 80px -20px rgba(28,111,230,.45);container-type:inline-size}}
.ilpdScreen{{--u:calc(100cqw / 1440);position:relative;overflow:hidden;aspect-ratio:1440 / 900;background:#fff;-webkit-user-select:none;user-select:none;cursor:default}}
@supports not (width:1cqw){{.ilpdScreen{{--u:calc(min(100vw - 64px, 1052px) / 1440)}}}}
.ilpdCam{{position:absolute;left:0;top:0;width:calc(1440*var(--u));height:calc(900*var(--u));transform-origin:0 0}}
.ilpd .ilpdCam,.ilpd .ilpdCam *{{pointer-events:none}}
.ilpd .ilpdScroll{{will-change:transform}}
.ilpd .ilpdWin,.ilpd .ilpdOdo{{position:relative;display:inline-block;overflow:hidden;vertical-align:bottom}}
@supports (clip-path:inset(0 -1em)){{.ilpd .ilpdWin,.ilpd .ilpdOdo{{overflow:visible;clip-path:inset(0 -.35em)}}}}
.ilpd .ilpdGhost{{visibility:hidden}}
.ilpd .ilpdStr{{position:absolute;left:0;top:0}}
.ilpd .ilpdStr > span{{display:block}}
.ilpd .ilpdOdoC{{display:inline-block}}
.ilpd .homeHeroNumber .ilpdWin{{line-height:.8;height:.8em}}
.ilpd .homeHeroNumber .ilpdStr > span,.ilpd .homeHeroNumber .ilpdGhost{{display:block;height:.8em;line-height:.8}}
.ilpd .homeKpiValue .ilpdWin,.ilpd .homeKpiValue .ilpdOdo{{height:1em;line-height:1}}
.ilpd .homeKpiValue .ilpdStr > span,.ilpd .homeKpiValue .ilpdGhost{{display:block;height:1em;line-height:1}}
.ilpd .homeSplitBar > i{{transform-origin:0 50%}}
.ilpd .dashTrendBar{{transform-box:fill-box;transform-origin:50% 100%}}
.ilpd .homeHeroGrid > i::after{{opacity:0}}
.ilpd .homeHeroGrid > i.isOn::after{{opacity:1}}
/* i cinque passaggi, accesi con la scena */
.ilpdRail{{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0 clamp(12px,1.8vw,22px);margin-top:26px;list-style:none}}
.ilpdRail li{{position:relative;display:flex;align-items:flex-start;gap:12px;padding-top:16px;border-top:1px solid var(--ilpd-line);color:var(--ilpd-text-2);font-size:14.5px;line-height:1.4}}
.ilpdRail li::before{{content:"";position:absolute;left:0;right:0;top:-1px;height:2px;background:var(--ilpd-ink);transform:scaleX(0);transform-origin:0 50%}}
.ilpdRail li > span:last-child{{display:flex;flex-direction:column;gap:2px;min-width:0}}
.ilpdRail b{{color:var(--ilpd-ink);font-weight:600}}
.ilpdRail li > span:last-child > span{{color:var(--ilpd-text-3);font-size:13.5px}}
.ilpdRailN{{position:relative;display:grid;place-items:center;flex:0 0 26px;height:26px;border-radius:50%;background:#ececee;color:var(--ilpd-ink);font-size:12.5px;font-weight:650}}
.ilpdRailN i{{position:absolute;inset:0;display:grid;place-items:center;border-radius:50%;background:var(--ilpd-ink);color:#fff;font-style:normal;opacity:0}}
.ilpdRailN::after{{content:"";position:absolute;inset:0;z-index:2;border-radius:50%;background:var(--ilpd-green) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center / 13px no-repeat;opacity:0}}
.ilpdCaption{{margin-top:18px;color:var(--ilpd-text-3);font-size:13.5px;line-height:1.5}}
.ilpdCaption a{{color:var(--ilpd-ink);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.2em;white-space:nowrap}}
@media (max-width:900px){{.ilpdRail{{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 16px}}}}
@media (max-width:640px){{.ilpdStage{{border-radius:22px}}.ilpdRail{{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}}.ilpdRail li{{align-items:center;gap:10px;padding-top:12px;font-size:14px}}.ilpdRail li > span:last-child > span{{display:none}}}}
@media (max-width:420px){{.ilpdRail{{gap:12px}}.ilpdRail li{{gap:9px;font-size:13.5px}}}}
/* in pausa fuori schermo: tutti gli elementi si fermano insieme e restano in sincrono */
.ilpd.isPaused,.ilpd.isPaused *,.ilpd.isPaused *::before,.ilpd.isPaused *::after{{animation-play-state:paused!important}}
'''


def build_css():
    sc = scene()
    cams = []
    for width, base, (aw, ah), name, pts in TIERS:
        view_h = W * ah / aw
        c = sc.tr(name, {'transform': cam_tf(base, pts[0][2], pts[0][3], view_h, base)})
        for t0, t1, fx, fy in pts[1:]:
            c.go(t0, t1, {'transform': cam_tf(base, fx, fy, view_h, base)}, CAM)
        cams.append((width, base, aw, ah, c))
    rest, run = sc.bind(ROOT, SCOPE)
    cam_names = {c.name for *_, c in cams}
    rest = [r for r in rest if not any(n in r for n in cam_names)]
    run = [r for r in run if not any(n in r for n in cam_names)]
    lines = ['/* stato a riposo = primo fotogramma (anche prima dell’avvio e senza JavaScript) */', *rest,
             f'/* la scena: {num(T)} s, tutte le tracce sullo stesso orologio; parte quando ilovepaghe-demo.js aggiunge .isVisible */', *run]
    resp = ['/* riquadri stretti: lo schermo disegnato più grande e una telecamera che segue l’azione */']
    for width, base, aw, ah, c in cams:
        resp.append(f'@container (max-width:{width}px){{\n'
                    f'  .ilpdScreen{{--u:calc(100cqw / 1440 * {num(base)});aspect-ratio:{aw} / {ah}}}\n'
                    f'  .ilpd .ilpdCam{{transform:{c.init["transform"]}}}\n'
                    f'  .ilpd.isVisible .ilpdCam{{animation:{c.name} {num(T)}s linear infinite}}\n}}')
    poster = [p for p in sc.poster(POSTER, SCOPE) if not any(n in p for n in cam_names)]
    reduce = ['/* «Riduci movimento»: un fotogramma fermo, con tutti i dati */', '@media (prefers-reduced-motion:reduce){',
              '  .ilpd .homeLiveDot::after{animation:none!important}', *['  ' + p for p in poster]]
    for width, base, aw, ah, c in cams:
        reduce.append(f'  @container (max-width:{width}px){{.ilpd .ilpdCam{{animation:none!important;transform:{c.value_at(POSTER)["transform"]}}}}}')
    reduce.append('}')
    css = (STATIC.format(T=num(T)) + '\n/* ---------- le regole della dashboard (demo pubblica), con lunghezze in --u ---------- */\n'
           + scoped_css() + '\n' + '\n'.join(lines) + '\n' + '\n'.join(resp) + '\n' + '\n'.join(reduce) + '\n' + sc.keyframes() + '\n')
    return css


def write():
    css = build_css()
    (PUBLIC / 'ilovepaghe-demo.css').write_text(css)
    sc = scene()
    still = ['/* Senza JavaScript la scena non parte: si mostra un fotogramma con tutti i dati. Caricato in <noscript>. */']
    still += [p.replace('animation:none!important;', '') for p in sc.poster(POSTER, SCOPE)]
    (PUBLIC / 'ilovepaghe-demo-static.css').write_text('\n'.join(still) + '\n')
    idx = PUBLIC / 'index.html'
    text = idx.read_text()
    start, end = '<!-- demo:inizio', '<!-- demo:fine -->'
    i = text.index(start)
    i = text.index('-->', i) + 3
    j = text.index(end)
    text = text[:i] + '\n    ' + html() + '\n    ' + text[j:]
    text = text.replace('<!-- demo:inizio — copiata da ilovepaghe-come-funziona (sections/hero.html), vedi ilovepaghe-demo.css -->',
                        '<!-- demo:inizio — dashboard di iLovePaghe, generata da build_dashboard.py, vedi ilovepaghe-demo.css -->')
    idx.write_text(text)
    print('css', len(css), 'html', len(html()))


if __name__ == '__main__':
    write()

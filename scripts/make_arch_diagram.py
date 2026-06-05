"""Generate a technical architecture diagram for the Story Authoring Tool."""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# ── Palette ───────────────────────────────────────────────────────────────────
BG          = '#1E1E2E'
FRONTEND_BG = '#251F38'
BACKEND_BG  = '#1A2030'
GEMINI_BG   = '#1A2A1F'
DATA_BG     = '#252510'
BORDER_FE   = '#7C3AED'
BORDER_BE   = '#06B6D4'
BORDER_GEM  = '#4ADE80'
BORDER_DATA = '#F5A623'
WHITE       = '#FFFFFF'
LIGHT       = '#CAC4D0'
ACCENT      = '#7C3AED'
CYAN        = '#06B6D4'
GREEN       = '#4ADE80'
ORANGE      = '#F5A623'
PURPLE_LIGHT= '#A78BFA'

W, H = 22, 10
fig, ax = plt.subplots(figsize=(W, H))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.axis('off')

# ── Helpers ───────────────────────────────────────────────────────────────────
def box(x, y, w, h, bg, border, lw=2.2):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle='round,pad=0.1',
        facecolor=bg, edgecolor=border, linewidth=lw, zorder=2))

def hdr(x, y, w, h, color):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle='round,pad=0.1',
        facecolor=color, edgecolor='none', zorder=3))

def txt(x, y, s, size=10, color=WHITE, ha='center', va='center',
        bold=False, italic=False):
    ax.text(x, y, s, ha=ha, va=va, fontsize=size, color=color,
            fontweight='bold' if bold else 'normal',
            fontstyle='italic' if italic else 'normal', zorder=4)

def arr(x0, y0, x1, y1, color, lw=2.0, dashed=False, rad=0.0):
    ls = (0, (5, 3)) if dashed else 'solid'
    ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
        arrowprops=dict(arrowstyle='->', color=color, lw=lw,
                        linestyle=ls,
                        connectionstyle=f'arc3,rad={rad}'), zorder=5)

def pill(x, y, s, bg, fg=BG, size=8):
    ax.text(x, y, s, ha='center', va='center', fontsize=size,
            color=fg, fontweight='bold', zorder=6,
            bbox=dict(boxstyle='round,pad=0.22', facecolor=bg,
                      edgecolor='none'))

def section(x, y, s, color=ORANGE):
    txt(x, y, s, size=9, color=color, ha='left', bold=True)

def item(x, y, s, color=LIGHT):
    txt(x, y, f'· {s}', size=8.2, color=color, ha='left')

# ─────────────────────────────────────────────────────────────────────────────
# Layout constants
# ─────────────────────────────────────────────────────────────────────────────
#  FE box    : 0.3  – 5.5   (width 5.2)
#  gap 1     : 5.5  – 9.0   (width 3.5)  centre 7.25
#  BE box    : 9.0  – 14.5  (width 5.5)
#  gap 2     : 14.5 – 16.5  (width 2.0)  centre 15.5
#  Gemini box: 16.5 – 21.7  (width 5.2)  — clipped to canvas at 22
FE_X, FE_Y, FE_W, FE_H   = 0.3,  2.6, 5.2, 6.0
BE_X, BE_Y, BE_W, BE_H   = 9.0,  2.6, 5.5, 6.0
GEM_X, GEM_Y, GEM_W, GEM_H = 16.5, 2.6, 5.2, 6.0

GAP1_CX = (FE_X + FE_W + BE_X) / 2   # 7.25
GAP2_CX = (BE_X + BE_W + GEM_X) / 2  # 15.5
MID_Y   = FE_Y + FE_H / 2             # 5.6

# ── Title ─────────────────────────────────────────────────────────────────────
txt(W / 2, 9.6, 'Story Authoring Tool — Technical Architecture',
    size=15, bold=True)
ax.axhline(9.3, color=ACCENT, lw=1.5, zorder=3, xmin=0.02, xmax=0.98)

# ─────────────────────────────────────────────────────────────────────────────
# FRONTEND
# ─────────────────────────────────────────────────────────────────────────────
box(FE_X, FE_Y, FE_W, FE_H, FRONTEND_BG, BORDER_FE)
hdr(FE_X, FE_Y + FE_H - 0.72, FE_W, 0.72, BORDER_FE)
txt(FE_X + FE_W/2, FE_Y + FE_H - 0.36, 'Frontend', size=13, bold=True)
txt(FE_X + FE_W/2, FE_Y + FE_H - 1.05, 'React 18 · TypeScript · Zustand', size=9, color=LIGHT)
txt(FE_X + FE_W/2, FE_Y + FE_H - 1.45, 'localhost:5174', size=8.5, color=BORDER_FE)

section(FE_X+0.2, FE_Y+3.7, 'User inputs', ORANGE)
for i, s in enumerate([
    'Chapter (Genki I Ch.1–12)',
    'Path A: Japanese source text',
    'Path B: topic in English',
    'Steering instructions',
    'Grammar distribution / temperature',
]):
    item(FE_X+0.35, FE_Y+3.38 - i*0.33, s)

section(FE_X+0.2, FE_Y+1.3, 'Client-side validation  (8 stages)', GREEN)
for i, s in enumerate([
    'JSON parse → schema_version → required fields',
    'parallel array parity → grammar index bounds',
    'vocab key resolution → difficulty format',
]):
    item(FE_X+0.35, FE_Y+0.98 - i*0.3, s, color=LIGHT)

pill(FE_X+FE_W/2, FE_Y+0.22, '⬇  Download validated .json story file', GREEN)

# ─────────────────────────────────────────────────────────────────────────────
# BACKEND
# ─────────────────────────────────────────────────────────────────────────────
box(BE_X, BE_Y, BE_W, BE_H, BACKEND_BG, BORDER_BE)
hdr(BE_X, BE_Y + BE_H - 0.72, BE_W, 0.72, BORDER_BE)
txt(BE_X+BE_W/2, BE_Y+BE_H-0.36, 'Backend', size=13, bold=True, color=BG)
txt(BE_X+BE_W/2, BE_Y+BE_H-1.05, 'FastAPI · Python · asyncio', size=9, color=LIGHT)
txt(BE_X+BE_W/2, BE_Y+BE_H-1.45, 'localhost:8000', size=8.5, color=BORDER_BE)

section(BE_X+0.2, BE_Y+3.7, 'Endpoints', CYAN)
ep_rows = [
    ('GET /run_sse',          'SSE stream — main generation'),
    ('POST /suggest-topic',   'topic suggestion (non-streaming)'),
    ('POST /cancel/{run_id}', 'cancel in-flight run'),
    ('GET /health',           'liveness check'),
]
for i, (ep, note) in enumerate(ep_rows):
    y = BE_Y + 3.38 - i * 0.44
    txt(BE_X+0.35, y, ep,   size=9, color=WHITE, ha='left', bold=True)
    txt(BE_X+0.35, y-0.22, note, size=8, color=LIGHT, ha='left')

section(BE_X+0.2, BE_Y+1.3, 'Prompt construction', ORANGE)
item(BE_X+0.35, BE_Y+0.98, 'Cumulative vocab injected (Ch.1–N)')
item(BE_X+0.35, BE_Y+0.68, 'Cumulative grammar injected (Ch.1–N)')
item(BE_X+0.35, BE_Y+0.38, 'Steering instructions + temperature')

# ─────────────────────────────────────────────────────────────────────────────
# GEMINI
# ─────────────────────────────────────────────────────────────────────────────
box(GEM_X, GEM_Y, GEM_W, GEM_H, GEMINI_BG, BORDER_GEM)
hdr(GEM_X, GEM_Y+GEM_H-0.72, GEM_W, 0.72, BORDER_GEM)
txt(GEM_X+GEM_W/2, GEM_Y+GEM_H-0.36, 'Gemini API', size=13, bold=True, color=BG)
txt(GEM_X+GEM_W/2, GEM_Y+GEM_H-1.05, 'google-genai Python SDK', size=9, color=LIGHT)
txt(GEM_X+GEM_W/2, GEM_Y+GEM_H-1.45, 'gemini-2.5-flash', size=8.5, color=BORDER_GEM)

section(GEM_X+0.2, GEM_Y+3.7, 'Streaming generation', GREEN)
item(GEM_X+0.35, GEM_Y+3.38, 'aio.models.generate_content_stream()')
item(GEM_X+0.35, GEM_Y+3.05, 'Thinking tokens  (budget: 16 384)')
item(GEM_X+0.35, GEM_Y+2.72, 'include_thoughts=True')

section(GEM_X+0.2, GEM_Y+2.28, 'Response chunks', ORANGE)
item(GEM_X+0.35, GEM_Y+1.95, 'thought parts  →  AGENT_STATUS')
item(GEM_X+0.35, GEM_Y+1.62, 'content parts  →  JSON story')
item(GEM_X+0.35, GEM_Y+1.29, '                    or plain-text proposal')

section(GEM_X+0.2, GEM_Y+0.88, 'Non-streaming (/suggest-topic)', CYAN)
item(GEM_X+0.35, GEM_Y+0.55, '64 tokens max · thinking disabled')

# ─────────────────────────────────────────────────────────────────────────────
# DATA FILE BOXES  (below Backend)
# ─────────────────────────────────────────────────────────────────────────────
D1X, D1Y, D1W, D1H = 9.1, 0.2, 2.5, 1.9
box(D1X, D1Y, D1W, D1H, DATA_BG, BORDER_DATA, lw=1.6)
txt(D1X+D1W/2, D1Y+1.58, 'genki1vocab.csv', size=9, bold=True, color=ORANGE)
txt(D1X+D1W/2, D1Y+1.23, '1 172 vocab entries', size=8, color=LIGHT)
txt(D1X+D1W/2, D1Y+0.92, 'Genki I  Ch.1–12', size=8, color=LIGHT)
txt(D1X+D1W/2, D1Y+0.35, 'loaded at startup', size=7.5, color=ORANGE, italic=True)

D2X = D1X + D1W + 0.4
box(D2X, D1Y, D1W, D1H, DATA_BG, BORDER_DATA, lw=1.6)
txt(D2X+D1W/2, D1Y+1.58, 'grammar.csv', size=9, bold=True, color=ORANGE)
txt(D2X+D1W/2, D1Y+1.23, 'Grammar points', size=8, color=LIGHT)
txt(D2X+D1W/2, D1Y+0.92, 'Genki I  Ch.1–12', size=8, color=LIGHT)
txt(D2X+D1W/2, D1Y+0.35, 'loaded at startup', size=7.5, color=ORANGE, italic=True)

# Upward arrows from data files to backend
arr(D1X+D1W/2, D1Y+D1H, D1X+D1W/2, BE_Y, BORDER_DATA, lw=1.5, dashed=True)
arr(D2X+D1W/2, D1Y+D1H, D2X+D1W/2, BE_Y, BORDER_DATA, lw=1.5, dashed=True)

# ─────────────────────────────────────────────────────────────────────────────
# ARROWS  (FE ↔ BE)
# ─────────────────────────────────────────────────────────────────────────────

# 1) FE → BE : GET /run_sse  (top arrow, going right)
arr(FE_X+FE_W, MID_Y+0.85, BE_X, MID_Y+0.85, ACCENT, lw=2.2)
txt(GAP1_CX, MID_Y+1.15, 'GET /run_sse', size=9.5, color=ACCENT, bold=True)
txt(GAP1_CX, MID_Y+0.87, 'chapter · pathMode · inputText · temperature', size=7.5, color=LIGHT)

# 2) BE → FE : SSE / AG-UI events  (middle arrow, going left)
arr(BE_X, MID_Y+0.25, FE_X+FE_W, MID_Y+0.25, CYAN, lw=2.2)
txt(GAP1_CX, MID_Y-0.0, 'SSE  ·  AG-UI events', size=9.5, color=CYAN, bold=True)

# AG-UI event pills stacked below label
pills = [
    ('RUN_STARTED',        ACCENT),
    ('AGENT_STATUS',       ORANGE),
    ('TEXT_MESSAGE_CHUNK', CYAN),
    ('RUN_FINISHED',       GREEN),
    ('ERROR / CANCELLED',  '#F87171'),
]
PILL_TOP = MID_Y - 0.32
for i, (ev, col) in enumerate(pills):
    pill(GAP1_CX, PILL_TOP - i*0.29, ev, col)

# 3) FE → BE : POST /suggest-topic  (dashed, lower)
arr(FE_X+FE_W, MID_Y-2.1, BE_X, MID_Y-2.1, PURPLE_LIGHT, lw=1.5, dashed=True)
txt(GAP1_CX, MID_Y-1.95, 'POST /suggest-topic', size=8.5, color=PURPLE_LIGHT)

# 4) FE → BE : POST /cancel  (dashed, lowest)
arr(FE_X+FE_W, MID_Y-2.5, BE_X, MID_Y-2.5, PURPLE_LIGHT, lw=1.5, dashed=True)
txt(GAP1_CX, MID_Y-2.35, 'POST /cancel/{runId}', size=8.5, color=PURPLE_LIGHT)

# ─────────────────────────────────────────────────────────────────────────────
# ARROWS  (BE ↔ Gemini)
# ─────────────────────────────────────────────────────────────────────────────

# BE → Gemini : HTTPS streaming request
arr(BE_X+BE_W, MID_Y+0.6, GEM_X, MID_Y+0.6, GREEN, lw=2.2)
txt(GAP2_CX, MID_Y+0.9, 'HTTPS streaming', size=9.5, color=GREEN, bold=True)
txt(GAP2_CX, MID_Y+0.62, 'prompt + config', size=7.5, color=LIGHT)

# Gemini → BE : streaming response chunks
arr(GEM_X, MID_Y+0.0, BE_X+BE_W, MID_Y+0.0, ORANGE, lw=2.2)
txt(GAP2_CX, MID_Y-0.27, 'streaming chunks', size=9.5, color=ORANGE, bold=True)
txt(GAP2_CX, MID_Y-0.55, 'thoughts + content', size=7.5, color=LIGHT)

# ─────────────────────────────────────────────────────────────────────────────
# Path mode legend (bottom left)
# ─────────────────────────────────────────────────────────────────────────────
pill(2.6, 2.22, 'Path A  paste Japanese text  →  JSON story', BORDER_BE, size=8.2)
pill(2.6, 1.85, 'Path B  topic  →  English proposal  →  JSON story', BORDER_FE, size=8.2)

# ─────────────────────────────────────────────────────────────────────────────
out = r'c:\repo\nihonnohon\resources\arch-diagram-story-authoring-tool.png'
plt.savefig(out, dpi=150, bbox_inches='tight', facecolor=BG, pad_inches=0.15)
print(f'Saved: {out}')

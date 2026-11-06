from pathlib import Path
import json,re,subprocess,html,shutil
from PIL import Image,ImageDraw,ImageFont
R=Path('docs/crownmasters-manual-rebuilt');F=Path('docs/grimoire');glyph=dict(zip('KQRNPkqrnp','♔♕♖♘♙♚♛♜♞♟'));font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
figs=json.loads((R/'validation/figures.json').read_text());ps=json.loads((R/'validation/puzzles.json').read_text());byid={f['id']:f for f in figs}
for f in figs:
 im=Image.new('RGB',(840,900),'#fffaf0');d=ImageDraw.Draw(im);piecefont=ImageFont.truetype(font,108);label=ImageFont.truetype(font,28)
 for r,row in enumerate(f['fen'].split()[0].split('/')):
  cells=[]
  for c in row:cells.extend(['']*int(c) if c.isdigit() else [c])
  for col,pc in enumerate(cells):
   x=60+120*col;y=30+120*r;d.rectangle([x,y,x+120,y+120],fill='#f5eddd' if (r+col)%2==0 else '#c6b18e')
   if pc:d.text((x+60,y+60),glyph[pc],font=piecefont,fill='#14243c',anchor='mm')
  d.text((30,90+120*r),str(6-r),font=label,fill='#14243c',anchor='mm')
 for col in range(6):d.text((120+col*120,790),chr(97+col),font=label,fill='#14243c',anchor='mm')
 d.text((420,850),('White' if f['fen'].split()[1]=='w' else 'Black')+' to move',font=label,fill='#14243c',anchor='mm');im.save(R/'diagrams'/f"{f['id']}.png",optimize=True)
chapters={}
for file in sorted(F.glob('0[1-6]*.md')):
 content=file.read_text();entries=re.split(r'(?m)^## Chapter ',content)[1:];chapters[file.name[:2]]=[]
 for e in entries:
  title,body=e.split('\n',1);body=re.sub(r'<!-- diagram -->[\s\S]*?<!-- /diagram -->','',body)
  for f in figs:
   if f.get('file')==file.name and f.get('block') in body:body=body.replace(f['block'],f"\n\n![{f['caption']}](diagrams/{f['id']}.png){{width=55%}}\n\n"+(('Verified line: '+f['fields']['line']+'\n\n') if f['fields'].get('line') else '')+(('*Model note: DTM tables ignore repetition and 100/150-halfmove clocks; check the actual game history.*\n\n') if f['fields'].get('claim','').startswith('tablebase') else ''))
  sections=re.split(r'(?m)^### ',body);body=sections[0]+'\n'+'\n'.join('### '+x for x in sections[1:] if not any(x.lower().startswith(k) for k in ['learning objectives','prerequisites','guided exercise','independent exercises','answers','next lesson']))
  body=re.sub(r'(?m)^---\s*$','',body);chapters[file.name[:2]].append((re.sub(r'^[\w.]+\s*[—–-]\s*','',title),body))
def chapter(b,n):
 title,body=chapters[b][n-1];return '\n\n## '+title+'\n\n'+body
s='''---
title: "Crown & Calculation: The Crownmaster’s Manual"
subtitle: "Six-Square Chess, Tactics, Strategy, Calculation and Mastery"
author: "Crown & Calculation · Rebuilt Academy Edition"
date: "6 November 2026"
lang: en-US
---

# About this rebuilt edition

This is the Crownmaster’s Manual, rebuilt from the game’s checked instructional sources after the earlier workspace became unavailable. It is **not a byte-identical recovery of the earlier 217-page, 61,614-word file**. It contains an edited, reorganised selection of the owner’s Sovereign’s Grimoire, new practical guidance and 100 newly composed, exhaustively verified exercises. The actual page and word counts accompany the download. No game code, saves, rating system, market or deployment was changed.

The rules are crown-la6-v1: six files a–f and ranks 1–6, RNQKNR back ranks, no bishops, castling, double pawn steps or en passant, and mandatory Q/R/N promotion. Every diagram is White-at-bottom; its caption names the side to move. The workbook uses White to move throughout. All composed problems have zero halfmoves and no prior repetition history.

A verified mate means every legal defence was tested within the stated horizon. A finite engine preference is not a proof. Practical advice is counsel, not a promised Elo gain. Difficulty labels are editorial. DTM model results ignore repetition and draw counters; the official referee still controls the game’s actual outcome. No claim of human or superhuman strength follows from a product setting.

Worked examples reveal their answers. The 100 workbook problems have a **separate answer key**. On iPhone use the EPUB in Apple Books; its text reflows. The HTML is a single offline file. Save the PDF for printing or fixed-page reading.

## The safety scan

Before choosing: am I in check; what changed last move; what can be captured; which defender moved; what is the opponent’s strongest reply? Repeat the scan **after your intended move**. Keep a candidate only when you have examined resistance, not merely cooperation.

'''
s+='\n# PART I · The Foundations\n'
for n in range(1,8):s+=chapter('01',n)
for n in [7,5]:s+=chapter('03',n)
s+='\n# PART II · Tactics\n'
for n in range(1,12):s+=chapter('02',n)
s+='''
## Interference and the line defender

Interference blocks a defender’s route without necessarily moving the defender. On this bishop-free board, trace rook and queen lines square by square. Before trusting a rook to defend a knight, ask whether a pawn or piece can enter between them with tempo. A deflection asks a defender to leave; interference can leave it exactly where it stands. Check whether the blocker can be captured with check or whether a second defender survives. Do not label the idea a win before examining those replies.

'''
s+='\n# PART III · Advanced Tactics and Calculation\n'
for n in [1,2,3]:s+=chapter('04',n)
for n in [1,2]:s+=chapter('05',n)
s+='''
## Visualise the changed board

After a capture, remove the victim from your mental board. After promotion, replace the pawn rather than imagining both pieces. Recompute the king’s escape squares after every king move. For a drill, study a problem for thirty seconds, cover it, name every occupied square, then announce two legal plies and reconstruct the result. Accuracy comes before line length.

Stop a branch at a terminal result, a stable evaluation with a concrete reason, or a refutation. Do not stop because the opponent has made the move you wanted. Include a quiet candidate when checks and captures do not solve the problem. In the expert exercises, accepting a first move requires answering every legal defence.

'''
s+='\n# PART IV · Opening Theory and Strategy\n'
for n in [1,2,3,4,6,8,9]:s+=chapter('03',n)
s+='''
## What “best-supported” means

No first move is claimed solved. The initial position has ten legal moves. The published crown-repertoire-1 artifact stores a depth-7 shortlist with d3 highest in that particular finite search. That is a historical engine preference, not minimax proof. A move missing from the shortlist is not thereby illegal or refuted. Study a central-pawn plan, a knight-first plan, and a response to an early capture; those are descriptive categories, not invented official opening names.

A gambit needs concrete compensation: time, a line, a forcing threat or a recoverable pawn. Calculate refusal as well as acceptance. A trap is conditional: identify the opponent’s mistake and the safe deviation. Do not sell a tactical pattern as a forced win from the starting position.

'''
s+='\n# PART V · Endgame Mastery\n'
for n in range(4,9):s+=chapter('04',n)
s+='\n# PART VI · The Competitive Federation\n'
for n in [3,4,5,6,7]:s+=chapter('05',n)
s+='''
## Versioned competition and honest progress

The detailed older competition examples above describe their recorded policy. Newer worlds may use crown-competition-3; existing worlds finish their season under its saved policy. Read Qualification · What You Need before planning a route. A current Open invitation, Crown Path place or zonal field must be assessed under that world’s policy, not assumed from an older diagram.

Career Elo is Glicko-2 on the Crown scale, not FIDE strength. New v0.11+ careers begin at zero; legacy careers retain their stored origin. The displayed rating is floored at zero while the underlying value can fall below it. Established status requires twenty rated games **and** RD at most 100. Circuit Grades, permanent Federation Titles, cosmetic rating titles and Played Like analysis estimates are separate concepts. None is bought with Exchange profits.

Record your candidate and predicted defence before opening engine analysis. Compare the same position under documented budgets. A changing score is a reason to investigate, not to quote whichever number flatters your play. Keep private search out of rated assistance and official market pricing.

'''
s+='\n# PART VII · The Crown Exchange\n'
for n in range(1,8):s+=chapter('06',n)
s+='''
## Execution, settlement and risk

All currency is fictional. LMSR marginal price is not the average cost of a sizeable order. Fees are 1% of executed cash on buys and sells, rounded upward in microcrowns; buy cost rounds up and sale proceeds down. A basic winning share pays one crown, but net profit subtracts the amount paid. Cancellation uses a published payout vector, not a refund of your purchase price.

Live result markets can trade between published moves; length markets close at the start. The 400-ply playing limit is a censored chess result: result-market VOID and length-market Over are different settlement rules. Do not count a cap as a draw. Decisive overlaps the White-win and Black-win states; it is not an independent fourth outcome. A bracket conjunction can lose when its condition fails rather than refunding.

Track executable exit value, cost basis, realised P&L, unrealised P&L and pending closed positions separately. Test correlated scenarios and the VOID vector. Make paper forecasts before trading and score them on the same events. A lucky payout is not proof of calibrated judgement.

'''
s+='\n# PART VIII · The Twelve-Week Training Program\n'+re.sub(r'^# .*\n','',(F/'07-twelve-week-program.md').read_text())
s+='''
## Four workloads, the same discipline

Beginner: twenty minutes, accurate legal moves and a safety scan. Intermediate: forty minutes, short lines with the opponent’s reply. Advanced: sixty minutes, candidate comparison and accurate final boards. Elite study: seventy-five minutes with breaks, blind calculation and complete defence trees. These are workload suggestions, not rating predictions.

Each day: scan, solve without answers, study the week’s concept, review one of your own decisions, write one correction. Each week: one unseen assessment at a fixed budget and one review day. Record confidence before checking, move, defence, final board and error type. Separate a guess from a calculated solution. Retesting a familiar task measures retention; unseen tasks measure transfer.

'''
s+='\n# PART IX · Original Puzzle Workbook\n\nOne hundred new composed mate exercises. Difficulty is editorial, not Elo. Mate in N means force checkmate within N attacking moves, against every legal defence; longer groups have no shorter forced mate. Write a move and the strongest reply before opening the separate answer key.\n'
for p in ps:s+=f"\n### Puzzle {p['id']:03d}: {p['difficulty']} {{#puzzle-{p['id']}}}\n\n![White to move.](diagrams/puzzle-{p['id']}.png){{width=55%}}\n\n**Objective: mate in {p['mateIn']}.** Record your full line. [Answer](#answer-{p['id']}).\n\nPosition: `{p['fen']}`\n"
s+='\n# Workbook Answer Key\n\nThe accepted move sets are exhaustive for the stated horizon. Representative lines show a legal defence; the proof checked all defences, not only that printed line.\n'
for p in ps:s+=f"\n### Answer {p['id']:03d} {{#answer-{p['id']}}}\n\n[Return to puzzle](#puzzle-{p['id']}). **Accepted:** {', '.join(p['san'])}. **Verified line:** {' '.join(p['line'])}.\n\n"+('The first move checks: count all legal king moves, captures and interpositions. ' if '+' in p['san'][0] or '#' in p['san'][0] else 'The first move is quiet: locate the escape square or line it changes. ')+"At the final position the enemy king is attacked and has no legal reply. Reconstruct which piece controls each escape and protects the mating piece. Any unlisted first move misses this mate horizon; it is not necessarily losing the whole game.\n"
s+='\n# PART X · Cheat Sheets\n'
for title,items in [('Rules',['6×6; RNQKNR; no bishops, castling, double-step or en passant.','Promote to Q/R/N. Mate wins; stalemate draws.','Bare kings automatic; threefold/100 claimable; fivefold/150 automatic; mate takes precedence.']),('Opening',['Develop with purpose. Check your uncastled king before opening files.','A stored shortlist is not proof. Calculate the opponent’s central capture.']),('Tactics',['Fork, pin, skewer, discovery: name the targets and legal replies.','Deflection moves a defender; interference blocks its line.','A sacrifice needs calculation, not a decorative label.']),('Calculation',['Checks, captures, threats and a quiet candidate.','Remove captured pieces from the mental board.','Reject with a refutation; accept only after the defence test.']),('King safety',['Trace open files, diagonals and knight jumps.','Recount escapes after your proposed move.']),('Endgames',['Activate the king safely. Count promotion steps and interception squares.','Check the clock and history; DTM does not override draw policy.']),('Tournament',['Confirm policy, format, tiebreak and outstanding fixtures.','Separate sporting points, Career Elo, rank and titles.']),('Engine study',['Record build, budget, perspective and variation.','Search scores are provisional. Keep assistance out of official play.']),('Exchange',['Read claim, payout and VOID. Include slippage and both fees.','Expected score = P(win) + ½P(draw), not P(win).','Review correlated losses and executable exit value.'])]:s+='\n## '+title+'\n\n'+''.join('- '+x+'\n' for x in items)
s+='\n# Glossary\n'+re.sub(r'^# .*\n','',(F/'08-glossary.md').read_text())
s+='\n# Topic index\n\nUse the clickable contents and reader search for: adjudication; candidate moves; career rating; counterplay; decoy; deflection; double attack; endgame; exchange; fork; king safety; knight outpost; LMSR; material; opening; overload; pawn structure; pin; promotion; repetition; sacrifice; skewer; stalemate; time management; visualisation.\n'
s+='\n# Edition and verification notes\n\nRebuilt Academy edition, 6 November 2026. Edited source: the owner’s Sovereign’s Grimoire and published crown-la6-v1 code at commit 5126c1262a002260116a8bdcaf60bbe1d46a22cc. The composition records and verification logs accompany the editable source ZIP. This is a replacement edition, not recovery of the lost earlier file. No human rating or financial return is promised.\n'
(R/'Crownmasters-Manual.md').write_text(s)
# Print uses explicit image width; reflowable editions use responsive width.
(R/'source/print.md').write_text(re.sub(r'\{width=55%\}','{width=2.35in}',s))
(R/'style.css').write_text('body{max-width:48rem;margin:auto;padding:1rem;background:#fffaf0;color:#14243c;font:1.05rem/1.65 Georgia,serif}h1,h2{color:#581d35;line-height:1.25}h1{border-top:3px solid #b99a5d;padding-top:1em;margin-top:2em}img{max-width:100%;width:22rem;height:auto;display:block;margin:auto}figure{margin:1em 0}figcaption{font-size:.85em;text-align:center}table{display:block;overflow:auto;border-collapse:collapse;max-width:100%}td,th{border-bottom:1px solid #c6b18e;padding:.4em}code{overflow-wrap:anywhere;font-size:.8em}pre{white-space:pre-wrap}a{color:#722b4b}')
(R/'source/header.tex').write_text(r'''\usepackage{xcolor}
\usepackage{fancyhdr}
\definecolor{royal}{HTML}{581D35}
\definecolor{navy}{HTML}{14243C}
\AtBeginDocument{\hypersetup{colorlinks=true,linkcolor=royal,urlcolor=royal}}
\pagestyle{fancy}\fancyhf{}\fancyhead[L]{\small Crown \& Calculation}\fancyhead[R]{\small Crownmaster's Manual}\fancyfoot[C]{\thepage}
\setlength{\headheight}{14pt}
\setlength{\emergencystretch}{3em}
''')
subprocess.run(['pandoc',str(R/'Crownmasters-Manual.md'),'--standalone','--toc','--toc-depth=2','--embed-resources','--resource-path='+str(R),'--css',str(R/'style.css'),'-o',str(R/'Crownmasters-Manual.html')],check=True)
subprocess.run(['pandoc',str(R/'Crownmasters-Manual.md'),'--toc','--toc-depth=2','--resource-path='+str(R),'--css',str(R/'style.css'),'-o',str(R/'Crownmasters-Manual.epub')],check=True)
subprocess.run(['pandoc',str(R/'source/print.md'),'--resource-path='+str(R),'--pdf-engine=xelatex','--toc','--toc-depth=2','--top-level-division=chapter','-V','documentclass=report','-V','papersize=a4','-V','geometry:margin=20mm','-V','mainfont=DejaVu Serif','-V','sansfont=DejaVu Sans','-V','monofont=DejaVu Sans Mono','-V','fontsize=10pt','--include-in-header',str(R/'source/header.tex'),'-o',str(R/'Crownmasters-Manual.pdf')],check=True)
print('BUILT',len(s.split()),'raw manuscript words')

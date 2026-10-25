"""Rebuild the branded Gradia preview from a supplied gradient recording. Requires FFmpeg."""
from pathlib import Path
import argparse, subprocess, json, hashlib
parser=argparse.ArgumentParser();parser.add_argument('input',type=Path);args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;out=root/'docs/media';out.mkdir(parents=True,exist_ok=True)
def ff(*args):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(args.input)]))
duration=float(probe['format']['duration'])+0.6
logo=root/'apps/web/public/social/gradia.png'
if not logo.exists(): raise SystemExit('Run bun run assets:social first.')
filters=f'[0:v]scale=1300:630,crop=1200:630,fps=30,format=yuv420p,tpad=start_mode=clone:start_duration=0.6,setpts=PTS-STARTPTS[bg];[1:v]format=rgba,split=2[a][b];[a]fade=t=out:st=0.35:d=0.6:alpha=1[logo1];[b]fade=t=in:st={duration-0.45}:d=0.45:alpha=1[logo2];[bg][logo1]overlay=0:0:shortest=1[tmp];[tmp][logo2]overlay=0:0:shortest=1,split=2[webm][mp4]'
encoders=subprocess.check_output(['ffmpeg','-hide_banner','-encoders'],stderr=subprocess.DEVNULL,text=True)
mp4=['-c:v','libx264','-preset','slow','-crf','26'] if 'libx264' in encoders else ['-c:v','libopenh264','-b:v','800k']
ff('-i',args.input,'-loop','1','-i',logo,'-filter_complex',filters,'-map','[webm]','-t',duration,'-an','-c:v','libvpx-vp9','-crf','35','-b:v','0','-cpu-used','4','-row-mt','1','-threads','4',out/'gradia-preview.webm','-map','[mp4]','-t',duration,'-an',*mp4,'-pix_fmt','yuv420p','-movflags','+faststart','-threads','4',out/'gradia-preview.mp4')
ff('-i',logo,'-frames:v','1','-c:v','libwebp','-quality','92',out/'gradia-poster.webp')
ff('-i',out/'gradia-preview.webm','-vf','fps=10,scale=640:-2','-c:v','libwebp_anim','-quality','62','-compression_level','4','-loop','0','-an',out/'gradia-demo.webp')
(out/'provenance.json').write_text(json.dumps({'source':args.input.name,'sourceSha256':hashlib.sha256(args.input.read_bytes()).hexdigest(),'duration':duration,'introHoldSeconds':0.6,'logoFadeOut':[0.35,0.95],'outroFadeIn':[duration-0.45,duration]},indent=2)+'\n')

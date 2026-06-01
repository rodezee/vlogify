import os
import sys
import re
import argparse
from gtts import gTTS
from playwright.sync_api import sync_playwright
# Added CompositeAudioClip wrapper tools for mixing silent cushions natively
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips, CompositeVideoClip, CompositeAudioClip

def clean_only_symbols(text):
    """Strips markdown header markers and symbols from strings."""
    text = re.sub(r'#+\s*', '', text)
    text = text.replace('```', '')
    return text.strip()

def generate_text_layer(content, alt_text, index):
    """Renders a pixel-perfect transparent overlay with split layout: Top Alt Text & Bottom Narrative."""
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    
    if lines and lines[0].startswith('#'):
        title = clean_only_symbols(lines[0])
        body = "<br>".join([clean_only_symbols(l) for l in lines[1:]])
    else:
        title = ""
        body = "<br>".join([clean_only_symbols(l) for l in lines])
    
    html_content = f"""
    <html>
    <style>
        body {{ 
            position: relative;
            height: 100vh; 
            width: 100vw;
            font-family: sans-serif; 
            background: transparent; 
            color: #ffffff; 
            margin: 0; 
            padding: 0;
            overflow: hidden;
            box-sizing: border-box;
        }}
        
        .glass-pill {{
            background: rgba(0, 0, 0, 0.65);
            padding: 20px 40px;
            border-radius: 20px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            max-width: 80%;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            text-align: center;
        }}

        /* Anchors the extracted image Markdown description to the top center */
        .top-container {{
            position: absolute;
            top: 0px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            justify-content: center;
            width: 100%;
        }}
        .alt-title {{
            background: rgba(0, 0, 0, 0.65);
            padding: 10px;
            border-radius: 0 0 20px 20px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            max-width: 80%;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            text-align: center;
            font-size: 1.2em;
            font-weight: bold;
            text-shadow: 2px 2px 10px rgba(0,0,0,0.9);
        }}

        /* Anchors the title slide narratives firmly along the middle */
        .center-container {{
            position: absolute;
            top: 35%;
            transform: translateY(-35%);
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
        }}

        /* Anchors the main slide narratives firmly along the bottom */
        .bottom-container {{
            position: absolute;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
        }}
        .header {{ 
            font-size: 3.2em; 
            font-weight: bold; 
            margin-bottom: 15px; 
            color: #ffffff;
            text-shadow: 2px 2px 15px rgba(0,0,0,0.9);
        }}
        .content {{ 
            font-size: 1.8em; 
            color: #f0f0f0;
            line-height: 1.4; 
            text-shadow: 2px 2px 10px rgba(0,0,0,0.9);
        }}
    </style>
    <body>
        
        {"<div class='top-container'><div class='alt-title'>" + alt_text + "</div></div>" if alt_text else ""}
        
        {"<div class='center-container'><div class='glass-pill'><div class='header'>" + title + "</div></div></div>" if title else ""}

        {"<div class='bottom-container'><div class='glass-pill'><div class='content'>" + body + "</div></div></div>" if body else ""}

    </body>
    </html>
    """
    
    path = f"temp_txt_{index}.png"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})
        page.set_content(html_content)
        page.screenshot(path=path, omit_background=True)
        browser.close()
    return path

def create_vlog(md_text, music_path=None, language="en", volume=0.20, output="vlog_output.mp4", pause_duration=0.7):
    # Step 1: Pre-parse markdown blocks cleanly so images don't create empty slides
    raw_blocks = [p.strip() for p in md_text.split('\n\n') if p.strip()]
    processed_segments = []
    
    current_bg = None
    current_alt = ""
    
    for block in raw_blocks:
        img_match = re.search(r'!\[(.*?)\]\((.*?)\)', block)
        
        block_alt = img_match.group(1) if img_match else ""
        block_image = img_match.group(2) if img_match else None
        
        clean_narrative = re.sub(r'!\[.*?\]\((.*?)\)', '', block).strip()
        
        if block_image:
            current_bg = block_image
            current_alt = block_alt
            
        if not clean_narrative:
            continue
            
        processed_segments.append({
            'text': clean_narrative,
            'bg_image': current_bg,
            'alt_text': current_alt
        })
        
    print(f"INFO: Generated {len(processed_segments)} clean animated narrative blocks.")
    clips = []
    
    # Step 2: Build video timelines
    for i, seg in enumerate(processed_segments):
        text_content = seg['text']
        bg_image_path = seg['bg_image']
        alt_content = seg['alt_text']
        
        audio_path = f"temp_audio_{i}.mp3"
        txt_path = f"temp_txt_{i}.png"
        tts_text = clean_only_symbols(text_content)
        
        # --- Checkpoint Resumption Checks ---
        audio_exists = os.path.exists(audio_path)
        txt_exists = os.path.exists(txt_path)
        
        if audio_exists and txt_exists:
            print(f"Processing segment {i+1}/{len(processed_segments)}... [SKIPPED - Assets already generated]")
        else:
            print(f"Processing segment {i+1}/{len(processed_segments)}...")
            
            # 1. Generate Voice Audio if missing
            if not audio_exists:
                tts = gTTS(text=tts_text, lang=language)
                tts.save(audio_path)
                
            # 2. Generate Transparent Layout Frame if missing
            if not txt_exists:
                generate_text_layer(text_content, alt_content, i)
        
        # Load the speech asset structures into memory
        speech_clip = AudioFileClip(audio_path)
        
        # --- ENHANCEMENT: Pad Segment with Silence ---
        # Set total track segment length to include the trailing pause cushion
        duration = speech_clip.duration + pause_duration
        
        # Nest the speech within a Composite audio container stretched to the longer duration.
        # This keeps the track completely silent after the speech finishes playing.
        audio_clip = CompositeAudioClip([speech_clip]).with_duration(duration)
        
        if bg_image_path and not os.path.exists(bg_image_path):
            print(f"ERROR: Image not found '{bg_image_path}'")
        
        if bg_image_path and os.path.exists(bg_image_path):
            bg_clip = ImageClip(bg_image_path).resized(new_size=(1280, 720)).with_duration(duration)
            bg_clip = bg_clip.transform(lambda get_frame, t: get_frame(t), apply_to=[])
            bg_clip = bg_clip.resized(lambda t: 1.0 + 0.05 * (t / duration))
        else:
            bg_clip = ImageClip(size=(1280, 720), color=(26, 26, 26)).with_duration(duration)
            
        txt_clip = ImageClip(txt_path).resized(new_size=(1280, 720)).with_duration(duration)
        
        segment_clip = CompositeVideoClip([bg_clip, txt_clip], size=(1280, 720)).with_audio(audio_clip)
        clips.append(segment_clip)
        
    # Step 3: Combine tracks and mix background music
    if clips:
        final_video = concatenate_videoclips(clips, method="compose")
        
        if music_path and os.path.exists(music_path):
            print(f"INFO: Mixing background music from '{music_path}'...")
            bg_music = AudioFileClip(music_path)
            
            # Loop audio if shorter than the total presentation length
            if bg_music.duration < final_video.duration:
                bg_music = bg_music.with_duration(final_video.duration).transform(lambda gf, t: gf(t % bg_music.duration))
            else:
                bg_music = bg_music.with_duration(final_video.duration)
            
            # Safely scale background amplitude down using MoviePy 2.x API
            bg_music = bg_music.with_volume_scaled(volume)
            
            combined_audio = CompositeAudioClip([final_video.audio, bg_music])
            final_video = final_video.with_audio(combined_audio)
            
        print(f"INFO: Rendering master composition to target output path: '{output}'...")
        final_video.write_videofile(output, fps=24, codec='libx264', audio_codec='aac')
    else:
        print("Error: No text segments available to generate a presentation video.")
        
    # Clean up file structures ONLY after successful full master compilation 
    print("INFO: Master render complete. Sweeping away cache files...")
    for i in range(len(processed_segments)):
        if os.path.exists(f"temp_txt_{i}.png"):
            os.remove(f"temp_txt_{i}.png")
        if os.path.exists(f"temp_audio_{i}.mp3"):
            os.remove(f"temp_audio_{i}.mp3")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 vlogify.py --filename=filename.md [--encoding=utf-8 --music=background.m4a --language=en --volume=0.30 --pause=0.7]")
    else:
        parser = argparse.ArgumentParser()

        parser.add_argument("-f", "--filename", help="<filename.md> input markdown file, Required", required=True)
        parser.add_argument("-e", "--encoding", help="default: 'utf-8' | markdown file encoding", default='utf-8')
        parser.add_argument("-m", "--music", help="<filename.m4a> input background music", default=None)
        parser.add_argument("-l", "--language", help="default: en | to change language set it to: es, fr", default="en")
        parser.add_argument("-v", "--volume", help="default: 0.20 | tune the volume of the music", type=float, default=0.20)
        parser.add_argument("-o", "--output", help="default: vlog_output.mp4 | the output filename", default="vlog_output.mp4")
        parser.add_argument("-p", "--pause", help="default: 0.7 | pause duration in seconds at the end of each slide", type=float, default=0.7)

        args = parser.parse_args()
        print(f"INFO: {args}")

        try:
            with open(args.filename, 'r', encoding=args.encoding) as f:
                content = f.read()
            create_vlog(content, args.music, args.language, args.volume, args.output, args.pause)
        except FileNotFoundError:
            print(f"Error: The file '{args.filename}' was not found.")

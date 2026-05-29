![family](img/family.jpg)

# vlogify

## what is this?

This is a markdown text to speech video creator, made in python.  

![landscape](img/landscape.jpg)

# install

open the terminal and type:
```
git clone https://github.com/rodezee/vlogify

cd vlogify

pip install markdown playwright moviepy pillow

playwright install chromium

```

# use

Try to change the README.md of this project and run:
```
python3 vlogify.py -f README.md

```

Or bring your own music file and do:
```
python3 vlogify.py -f README.md -m my_music_file.m4a

```

If you want a custom output file:
```
python3 vlogify.py -f README.md -m my_music_file.m4a -o custom_output.mp4

```

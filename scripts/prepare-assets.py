from pathlib import Path
import shutil
root=Path(__file__).resolve().parent.parent
for folder in ['docs','media']:
    source=root/'docs' if folder=='docs' else root/'docs/media'
    target=root/'apps/web/public'/folder
    target.mkdir(parents=True,exist_ok=True)
    for file in source.iterdir():
        if file.is_file() and (folder=='media' or file.suffix=='.md'): shutil.copy2(file,target/file.name)

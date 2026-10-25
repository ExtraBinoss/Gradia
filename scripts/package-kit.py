"""Build a portable source kit. Runtime and app have no Python dependency."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
outputs = [root / 'apps/web/public/gradia-kit.zip']
if (root / 'dist').is_dir():
    outputs.append(root / 'dist/gradia-kit.zip')
for output in outputs:
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('README.md', '# Gradia portable kit\n\nCopy gradia/ for the prebuilt ESM + types, or gradient/ for editable sources. React is only needed for the React adapter. Read docs/integration.md and docs/agents.md.\n\nStudio: https://gradia.plinka.eu\nSource: https://github.com/ExtraBinoss/Gradia\n')
        for package, folder in [('core', 'core'), ('webgl', 'webgl'), ('react', 'react')]:
            for source in sorted((root / f'packages/{package}/src').glob('*')):
                if '.test.' in source.name:
                    continue
                text = source.read_text().replace('@plinka/gradient-core', '../core').replace('@plinka/gradient-webgl', '../webgl')
                archive.writestr(f'gradient/{folder}/{source.name}', text)
        video = (root / 'apps/web/src/features/editor/video.ts').read_text().replace('@plinka/gradient-core', '../core').replace('@plinka/gradient-webgl', '../webgl')
        archive.writestr('gradient/video/index.ts', video)
        for source in sorted((root / 'package').rglob('*')):
            if source.is_file():
                archive.write(source, 'gradia/' + str(source.relative_to(root / 'package')))
        for source in sorted((root / 'docs').glob('*.md')):
            archive.write(source, 'docs/' + source.name)
        for name in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
            archive.write(root / name, name)
import shutil
lib = root / 'dist-lib'
if lib.is_dir() and (root / 'dist').is_dir():
    shutil.copytree(lib, root / 'dist/lib', dirs_exist_ok=True)
for output in outputs:
    shutil.copy2(output, output.with_name('gradient-kit.zip'))
if (root / 'dist').is_dir():
    for folder in ['docs', 'media']:
        source = root / 'apps/web/public' / folder
        if source.exists(): shutil.copytree(source, root / 'dist' / folder, dirs_exist_ok=True)
print('Portable Gradia source + minified kit generated.')

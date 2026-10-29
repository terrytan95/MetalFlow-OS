#!/usr/bin/env python3
"""Install only MetalFlow's include in the existing host server."""
from pathlib import Path
import os, subprocess
config=Path('/etc/nginx/sites-enabled/terrytan.dev').resolve()
text=config.read_text(); line='    include /etc/nginx/snippets/metalflow.conf;\n'
if line not in text:
    anchor='    include /etc/nginx/snippets/fhr-scout.conf;\n'
    if text.count(anchor)!=1: raise SystemExit('Expected host anchor missing or ambiguous; no change made')
    updated=text.replace(anchor,anchor+line,1)
    target=config.with_name(config.name+'.metalflow-tmp')
    target.write_text(updated);os.chmod(target,config.stat().st_mode);os.replace(target,config)
    check=subprocess.run(['nginx','-t'])
    if check.returncode:
        target.write_text(text);os.chmod(target,config.stat().st_mode);os.replace(target,config)
        raise SystemExit('Validation failed; original host config restored in place')
    subprocess.run(['systemctl','reload','nginx'],check=True)
else:
    subprocess.run(['nginx','-t'],check=True)
print('MetalFlow route validated')

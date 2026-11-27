import http.server
import os
import subprocess
from urllib.parse import urlsplit

DIRECTORY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Chaua-Educa-main')
PORT = 5501
HOST = '127.0.0.1'

def build_info():
    root = os.path.dirname(DIRECTORY)
    def git(*args):
        return subprocess.check_output(
            ['git', '-C', root, *args], text=True, stderr=subprocess.DEVNULL
        ).strip()
    try:
        # Servers started from a source archive may have no Git metadata.
        if os.path.realpath(git('rev-parse', '--show-toplevel')) != os.path.realpath(root):
            return {'gitCommit': None}
        commit = git('rev-parse', 'HEAD')
        dirty = bool(git('status', '--porcelain', '--', 'Chaua-Educa-main'))
        return {'gitCommit': commit, 'dirty': dirty}
    except (OSError, subprocess.CalledProcessError):
        return {'gitCommit': None}


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        if self.command == 'HEAD' and urlsplit(self.path).query == 'chaua-build-info=1':
            info = build_info()
            if info['gitCommit']:
                self.send_header('X-Chaua-Git-Commit', info['gitCommit'])
                self.send_header('X-Chaua-Git-Dirty', str(info['dirty']).lower())
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    with http.server.ThreadingHTTPServer((HOST, PORT), NoCacheHandler) as httpd:
        print(f"Serving {DIRECTORY} on http://{HOST}:{PORT}/ with no-cache headers...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

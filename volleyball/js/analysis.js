// Client for the analysis server (volleyball/server). Uploads a match
// video, starts an analysis job, and polls until it finishes.
const Analysis = (() => {
  function base(prefs) {
    return String(prefs.serverUrl || '').replace(/\/+$/, '');
  }

  function headers(prefs) {
    return prefs.serverToken ? { Authorization: 'Bearer ' + prefs.serverToken } : {};
  }

  async function request(prefs, path, opts = {}) {
    let res;
    try {
      res = await fetch(base(prefs) + path, Object.assign({}, opts, {
        headers: Object.assign({}, headers(prefs), opts.headers || {})
      }));
    } catch (e) {
      throw new Error('Could not reach the analysis server. Check the address in Shortcuts & options.');
    }
    if (res.status === 401) throw new Error('The analysis server rejected the access token.');
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).detail; } catch (e) { /* not JSON */ }
      throw new Error(detail ? String(detail) : 'Server error ' + res.status);
    }
    return res.status === 204 ? null : res.json();
  }

  // XHR (not fetch) so we can show upload progress for multi-GB files.
  function upload(prefs, file, { angle, matchRef }, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', base(prefs) + '/api/videos');
      for (const [k, v] of Object.entries(headers(prefs))) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let body = null;
        try { body = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
        if (xhr.status === 201) resolve(body);
        else if (xhr.status === 401) reject(new Error('The analysis server rejected the access token.'));
        else reject(new Error((body && body.detail) || 'Upload failed (' + xhr.status + ')'));
      };
      xhr.onerror = () => reject(new Error('Upload failed. Check your connection and the server address.'));
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('angle', angle || 'other');
      if (matchRef) form.append('match_ref', matchRef);
      xhr.send(form);
    });
  }

  const analyze = (prefs, videoId, stages) => request(prefs, `/api/videos/${videoId}/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stages })
  });
  const job = (prefs, jobId) => request(prefs, `/api/jobs/${jobId}`);
  const removeVideo = (prefs, videoId) => request(prefs, `/api/videos/${videoId}`, { method: 'DELETE' });
  const health = (prefs) => request(prefs, '/api/health');

  return { upload, analyze, job, removeVideo, health, configured: (prefs) => !!base(prefs) };
})();

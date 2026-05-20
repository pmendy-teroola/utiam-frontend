const API_BASE = '';

async function api(method, path, body) {
  const token = localStorage.getItem('utiam_token');
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    authLogout();
    return null;
  }
  if (res.status === 204) return {};
  return res.json();
}

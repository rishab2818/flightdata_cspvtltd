const TOKEN_KEY='token'; const USER_KEY='user';
export const storage = {
  setToken(t){ localStorage.setItem(TOKEN_KEY, t) },
  getToken(){ return localStorage.getItem(TOKEN_KEY) },
  removeToken(){ localStorage.removeItem(TOKEN_KEY) },
  setUser(u){ localStorage.setItem(USER_KEY, JSON.stringify(u)) },
  getUser(){ try{ return JSON.parse(localStorage.getItem(USER_KEY)) }catch{ return null } },
  removeUser(){ localStorage.removeItem(USER_KEY) },
  clear(){ localStorage.clear() }
}

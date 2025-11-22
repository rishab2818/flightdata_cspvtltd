import axios from 'axios'
import { storage } from './storage'

const baseURL = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

export const axiosClient = axios.create({
  baseURL,
  // Disable request timeout so very large uploads are allowed to stream fully
  // from the browser to the backend without aborting.
  timeout: 0,
})
export function attachUnauthorizedHandler(onUnauthorized){
  axiosClient.interceptors.response.use(
    (res)=>res,
    (err)=>{ const s = err?.response?.status; if(s===401||s===403) onUnauthorized?.(); return Promise.reject(err) }
  )
}
axiosClient.interceptors.request.use((config)=>{
  const t = storage.getToken(); if(t) config.headers.Authorization = `Bearer ${t}`; return config
})

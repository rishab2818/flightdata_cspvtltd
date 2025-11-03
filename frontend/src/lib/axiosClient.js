import axios from 'axios'
import { storage } from './storage'

export const axiosClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  timeout: 15000,
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

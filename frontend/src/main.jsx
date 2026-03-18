import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { TaskAcknowledgementProvider } from './modules/taskAcknowledgements/context/TaskAcknowledgementContext'
import { LoaderProvider } from './context/LoaderContext'
import App from './App'
import './styles.css'
import './styles/layout.css'
import './styles/dashboard.css'
import "./styles/common.css";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <TaskAcknowledgementProvider>
          <LoaderProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </LoaderProvider>
        </TaskAcknowledgementProvider>
      </NotificationProvider>
    </AuthProvider>
  </React.StrictMode>
)
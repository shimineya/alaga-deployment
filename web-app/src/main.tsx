import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/globals.css";
import axios from 'axios';
import { API_URL } from './lib/config';

axios.defaults.baseURL = API_URL;

createRoot(document.getElementById("root")!).render(<App />);
import axios from "axios";

export const API_BASE_URL = "/api";
const token = localStorage.getItem("authToken");
const api = axios.create({
  baseURL: API_BASE_URL,
  params: {},
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  withXSRFToken: true,
  withCredentials: true,
});

export const setAuthToken = (token: string) => {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export const clearAuthToken = () => {
  delete api.defaults.headers.common["Authorization"];
};

export default api;

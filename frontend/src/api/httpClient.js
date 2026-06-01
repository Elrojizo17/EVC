import axios from "axios";

const httpClient = axios.create();

httpClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("evc_token");
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default httpClient;

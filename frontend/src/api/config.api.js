import httpClient from "./httpClient";

const API_URL = "https://luminariasevc.onrender.com/api/config";

export const getUiConfig = async () => {
    try {
        const response = await httpClient.get(`${API_URL}/ui`);
        return response.data;
    } catch (error) {
        console.error("Error fetching UI config:", error);
        throw error;
    }
};

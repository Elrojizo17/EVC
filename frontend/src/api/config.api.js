import axios from "axios";

const API_URL = "http://localhost:3000/api/config";

export const getUiConfig = async () => {
    try {
        const response = await axios.get(`${API_URL}/ui`);
        return response.data;
    } catch (error) {
        console.error("Error fetching UI config:", error);
        throw error;
    }
};

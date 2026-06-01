export const authFetch = (url, options = {}) => {
    const token = localStorage.getItem("evc_token");
    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    return fetch(url, {
        ...options,
        headers
    });
};

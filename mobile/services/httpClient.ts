import axios from "axios";
import { Platform } from "react-native";
import { API_BASE_URL } from "@/config/constants";
import { getAccessToken } from "@/utils/authSession";

const httpClient = axios.create({
	baseURL: API_BASE_URL,
	...(Platform.OS === "web" ? { withCredentials: true } : {}),
});

httpClient.interceptors.request.use((request) => {
	request.headers = request.headers ?? {};
	return getAccessToken().then((accessToken) => {
		if (accessToken) {
			request.headers!.Authorization = accessToken;
		}
		if (request.data instanceof FormData) {
			request.headers!["Content-Type"] = "multipart/form-data";
		} else {
			request.headers!["Content-Type"] = "application/json";
		}
		request.headers!.Accept = "application/json";
		return request;
	}) as any;
});

httpClient.interceptors.response.use(
	(response) => response,
	(error) => {
		return Promise.reject(error);
	},
);

export default httpClient;
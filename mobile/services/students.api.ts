import httpClient from './httpClient';

export const getStudentById = async (id: string): Promise<any> => {
  const response = await httpClient.get(`/students/${id}`);
  return (response as any).data.data;
};

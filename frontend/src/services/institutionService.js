import api from './api';

export const getInstitutionDetails = async (institutionId) => {
  if (!institutionId) return null;
  try {
    const response = await api.get(`/institutions/${institutionId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to load institution details:', error);
    return null;
  }
};
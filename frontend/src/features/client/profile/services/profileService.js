// profileService.js
import { apiFetch } from '../../../../utils/api';

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
};

export const updateUser = async (updatedData) => {
  const data = await apiFetch('/auth/perfil', {
    method: 'PUT',
    body: JSON.stringify(updatedData),
    timeout: 90000,
  });

  // Actualizar el usuario en localStorage con los nuevos datos
  const currentUser = getCurrentUser();
  const updated = { ...currentUser, ...updatedData };
  localStorage.setItem('usuario', JSON.stringify(updated));

  return updated;
};

export const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const eliminarCuenta = async () => {
  return apiFetch('/auth/mi-cuenta', { method: 'DELETE' });
};
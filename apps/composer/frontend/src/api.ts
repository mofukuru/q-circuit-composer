import axios from 'axios';
import { CircuitRequest, CircuitResponse, Gate } from './types';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000' 
  : '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  async executeCircuit(circuitData: CircuitRequest): Promise<CircuitResponse> {
    try {
      // Default to requesting all code formats if not specified
      const payload = {
        ...circuitData,
        code_formats: circuitData.code_formats ?? ['pennylane','qiskit','qulacs','qasm'],
      };
      const response = await api.post<CircuitResponse>('/execute', payload);
      return response.data;
    } catch (error: any) {
      console.error('Error executing circuit:', error);
      throw new Error(error.response?.data?.detail || 'Failed to execute circuit');
    }
  },

  async getAvailableGates(): Promise<Gate[]> {
    try {
      const response = await api.get('/gates');
      return response.data.gates;
    } catch (error: any) {
      console.error('Error fetching gates:', error);
      throw new Error('Failed to fetch available gates');
    }
  },

  async healthCheck(): Promise<boolean> {
    try {
      await api.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  },
};
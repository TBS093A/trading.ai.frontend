import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

/**
 * Helper function to extract error message from API error response
 * FastAPI 422 errors have format: { detail: [{ type, loc, msg, input }] }
 * Standard errors have format: { detail: "string message" }
 */
const extractErrorMessage = (error, fallbackMessage) => {
  const detail = error.response?.data?.detail;
  
  if (!detail) {
    return error.message || fallbackMessage;
  }
  
  // If detail is an array (Pydantic validation errors), extract messages
  if (Array.isArray(detail)) {
    const messages = detail.map(err => {
      if (typeof err === 'object' && err.msg) {
        // Include location for context: "field_name: error message"
        const loc = err.loc?.slice(-1)?.[0] || '';
        return loc ? `${loc}: ${err.msg}` : err.msg;
      }
      return String(err);
    });
    return messages.join('; ') || fallbackMessage;
  }
  
  // If detail is a string, return it directly
  if (typeof detail === 'string') {
    return detail;
  }
  
  // If detail is an object with a message property
  if (typeof detail === 'object' && detail.msg) {
    return detail.msg;
  }
  
  return fallbackMessage;
};

/**
 * Async thunk do tworzenia nowej zapisanej analizy
 */
export const createSavedAnalysis = createAsyncThunk(
  'savedAnalysis/create',
  async (analysisData, { rejectWithValue }) => {
    try {
      const response = await api.createSavedAnalysis(analysisData);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        extractErrorMessage(error, 'Błąd podczas zapisywania analizy')
      );
    }
  }
);

/**
 * Async thunk do pobierania listy zapisanych analiz użytkownika
 */
export const fetchSavedAnalyses = createAsyncThunk(
  'savedAnalysis/fetchAll',
  async ({ limit = 50, offset = 0 } = {}, { rejectWithValue }) => {
    try {
      const response = await api.getSavedAnalyses(limit, offset);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        extractErrorMessage(error, 'Błąd podczas pobierania zapisanych analiz')
      );
    }
  }
);

/**
 * Async thunk do pobierania pełnych danych zapisanej analizy
 */
export const fetchSavedAnalysis = createAsyncThunk(
  'savedAnalysis/fetchOne',
  async (analysisId, { rejectWithValue }) => {
    try {
      const response = await api.getSavedAnalysis(analysisId);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        extractErrorMessage(error, 'Błąd podczas pobierania analizy')
      );
    }
  }
);

/**
 * Async thunk do aktualizacji zapisanej analizy
 */
export const updateSavedAnalysis = createAsyncThunk(
  'savedAnalysis/update',
  async ({ analysisId, updateData }, { rejectWithValue }) => {
    try {
      const response = await api.updateSavedAnalysis(analysisId, updateData);
      return { ...response.data, analysisId };
    } catch (error) {
      return rejectWithValue(
        extractErrorMessage(error, 'Błąd podczas aktualizacji analizy')
      );
    }
  }
);

/**
 * Async thunk do usuwania zapisanej analizy
 */
export const deleteSavedAnalysis = createAsyncThunk(
  'savedAnalysis/delete',
  async (analysisId, { rejectWithValue }) => {
    try {
      const response = await api.deleteSavedAnalysis(analysisId);
      return { ...response.data, analysisId };
    } catch (error) {
      return rejectWithValue(
        extractErrorMessage(error, 'Błąd podczas usuwania analizy')
      );
    }
  }
);

const savedAnalysisSlice = createSlice({
  name: 'savedAnalysis',
  initialState: {
    // Lista zapisanych analiz (skrócone info)
    analyses: [],
    totalCount: 0,
    
    // Search term for filtering
    searchTerm: '',
    
    // Aktualnie ładowana/wyświetlana pełna analiza
    currentAnalysis: null,
    
    // Tryb edycji - ID analizy która jest edytowana (null = tryb tworzenia)
    editingAnalysisId: null,
    
    // Flagi stanu
    loading: false,
    creating: false,
    updating: false,
    deleting: false,
    
    // Błędy
    error: null,
    
    // Sukces operacji (do wyświetlania komunikatów)
    lastSuccess: null,
    
    // ID analizy która jest właśnie ładowana
    loadingAnalysisId: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.lastSuccess = null;
    },
    clearCurrentAnalysis: (state) => {
      state.currentAnalysis = null;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
    // Ustawia tryb edycji - analiza do edycji
    setEditingAnalysis: (state, action) => {
      state.editingAnalysisId = action.payload;
    },
    // Wyłącza tryb edycji
    clearEditingAnalysis: (state) => {
      state.editingAnalysisId = null;
    },
    // Aktualizuje description lokalnie w liście (po edycji inline)
    updateAnalysisDescription: (state, action) => {
      const { analysisId, description } = action.payload;
      const analysis = state.analyses.find(a => a.id === analysisId);
      if (analysis) {
        analysis.description = description;
      }
    },
    // Resetuje cały stan (np. przy wylogowaniu)
    resetSavedAnalysisState: (state) => {
      state.analyses = [];
      state.totalCount = 0;
      state.searchTerm = '';
      state.currentAnalysis = null;
      state.editingAnalysisId = null;
      state.loading = false;
      state.creating = false;
      state.updating = false;
      state.deleting = false;
      state.error = null;
      state.lastSuccess = null;
      state.loadingAnalysisId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // === CREATE ===
      .addCase(createSavedAnalysis.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createSavedAnalysis.fulfilled, (state, action) => {
        state.creating = false;
        state.lastSuccess = {
          type: 'create',
          message: action.payload.message || 'Analiza została zapisana',
          data: action.payload.data,
        };
        // Odśwież listę po utworzeniu nowej analizy
      })
      .addCase(createSavedAnalysis.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload;
      })
      
      // === FETCH ALL ===
      .addCase(fetchSavedAnalyses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSavedAnalyses.fulfilled, (state, action) => {
        state.loading = false;
        state.analyses = action.payload.analyses || [];
        state.totalCount = action.payload.total_count || 0;
      })
      .addCase(fetchSavedAnalyses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // === FETCH ONE ===
      .addCase(fetchSavedAnalysis.pending, (state, action) => {
        state.loadingAnalysisId = action.meta.arg;
        state.error = null;
      })
      .addCase(fetchSavedAnalysis.fulfilled, (state, action) => {
        state.loadingAnalysisId = null;
        state.currentAnalysis = action.payload.analysis;
      })
      .addCase(fetchSavedAnalysis.rejected, (state, action) => {
        state.loadingAnalysisId = null;
        state.error = action.payload;
      })
      
      // === UPDATE ===
      .addCase(updateSavedAnalysis.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateSavedAnalysis.fulfilled, (state, action) => {
        state.updating = false;
        state.lastSuccess = {
          type: 'update',
          message: action.payload.message || 'Analiza została zaktualizowana',
          data: action.payload.data,
        };
        // Aktualizuj nazwę w liście jeśli została zmieniona
        const analysisId = action.payload.analysisId;
        const updatedFields = action.payload.data?.updated_fields || [];
        if (updatedFields.includes('name') && state.analyses.length > 0) {
          // Odświeżenie listy będzie wykonane przez komponent
        }
      })
      .addCase(updateSavedAnalysis.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })
      
      // === DELETE ===
      .addCase(deleteSavedAnalysis.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteSavedAnalysis.fulfilled, (state, action) => {
        state.deleting = false;
        const deletedId = action.payload.data?.deleted_analysis_id;
        // Usuń z lokalnej listy
        if (deletedId) {
          state.analyses = state.analyses.filter(a => a.id !== deletedId);
          state.totalCount = Math.max(0, state.totalCount - 1);
        }
        state.lastSuccess = {
          type: 'delete',
          message: action.payload.message || 'Analiza została usunięta',
          data: action.payload.data,
        };
        // Wyczyść currentAnalysis jeśli to była ta sama
        if (state.currentAnalysis?.id === deletedId) {
          state.currentAnalysis = null;
        }
      })
      .addCase(deleteSavedAnalysis.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearError,
  clearSuccess,
  clearCurrentAnalysis,
  setSearchTerm,
  setEditingAnalysis,
  clearEditingAnalysis,
  updateAnalysisDescription,
  resetSavedAnalysisState,
} = savedAnalysisSlice.actions;

// Selektory
export const selectSavedAnalyses = (state) => state.savedAnalysis.analyses;
export const selectTotalCount = (state) => state.savedAnalysis.totalCount;
export const selectSearchTerm = (state) => state.savedAnalysis.searchTerm;
export const selectEditingAnalysisId = (state) => state.savedAnalysis.editingAnalysisId;
export const selectCurrentAnalysis = (state) => state.savedAnalysis.currentAnalysis;
export const selectSavedAnalysisLoading = (state) => state.savedAnalysis.loading;
export const selectSavedAnalysisCreating = (state) => state.savedAnalysis.creating;
export const selectSavedAnalysisUpdating = (state) => state.savedAnalysis.updating;
export const selectSavedAnalysisDeleting = (state) => state.savedAnalysis.deleting;
export const selectSavedAnalysisError = (state) => state.savedAnalysis.error;
export const selectLastSuccess = (state) => state.savedAnalysis.lastSuccess;
export const selectLoadingAnalysisId = (state) => state.savedAnalysis.loadingAnalysisId;

export default savedAnalysisSlice.reducer;


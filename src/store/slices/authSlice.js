import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunk dla logowania
export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const response = await api.login(username, password);
      // Zapisz token w localStorage
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('authUser', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Błąd logowania'
      );
    }
  }
);

// Async thunk dla wylogowania
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await api.logout();
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      return true;
    } catch (error) {
      // Nawet jeśli logout na serwerze nie powiedzie się, wyczyść lokalne dane
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      return true;
    }
  }
);

// Async thunk dla weryfikacji sesji
export const verifySession = createAsyncThunk(
  'auth/verifySession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.verifySession();
      return response.data;
    } catch (error) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      return rejectWithValue('Sesja wygasła');
    }
  }
);

// Async thunk dla zmiany hasła
export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const response = await api.changePassword(currentPassword, newPassword);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Błąd zmiany hasła'
      );
    }
  }
);

// Async thunk dla aktualizacji profilu
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async ({ username }, { rejectWithValue }) => {
    try {
      const response = await api.updateMyProfile({ username });
      // Zaktualizuj dane w localStorage
      const user = JSON.parse(localStorage.getItem('authUser') || '{}');
      user.username = response.data.username;
      localStorage.setItem('authUser', JSON.stringify(user));
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Błąd aktualizacji profilu'
      );
    }
  }
);

// Async thunk dla wgrywania avatara
export const uploadAvatar = createAsyncThunk(
  'auth/uploadAvatar',
  async (file, { rejectWithValue }) => {
    try {
      const response = await api.uploadAvatar(file);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.detail || 'Błąd wgrywania avatara'
      );
    }
  }
);

// Async thunk dla pobierania avatara
export const fetchAvatar = createAsyncThunk(
  'auth/fetchAvatar',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getMyAvatar();
      return response.data;
    } catch (error) {
      return rejectWithValue('Błąd pobierania avatara');
    }
  }
);

// Pobierz początkowy stan z localStorage
const getInitialState = () => {
  const token = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('authUser');
  let user = null;
  
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error('Error parsing user from localStorage:', e);
    }
  }
  
  return {
    isAuthenticated: !!token,
    user,
    token,
    loading: false,
    error: null,
    sessionVerified: false,
    avatar: null,
    avatarLoading: false,
    passwordChangeLoading: false,
    passwordChangeSuccess: false,
    profileUpdateLoading: false,
  };
};

const authSlice = createSlice({
  name: 'auth',
  initialState: getInitialState(),
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearPasswordChangeSuccess: (state) => {
      state.passwordChangeSuccess = false;
    },
    resetAuth: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.sessionVerified = false;
      state.avatar = null;
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.sessionVerified = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })
      // Logout
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.sessionVerified = false;
        state.avatar = null;
      })
      .addCase(logout.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.sessionVerified = false;
        state.avatar = null;
      })
      // Verify Session
      .addCase(verifySession.pending, (state) => {
        state.loading = true;
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.sessionVerified = true;
        if (action.payload.user) {
          state.user = action.payload.user;
        }
      })
      .addCase(verifySession.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.sessionVerified = true; // Verified that session is invalid
      })
      // Change Password
      .addCase(changePassword.pending, (state) => {
        state.passwordChangeLoading = true;
        state.passwordChangeSuccess = false;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.passwordChangeLoading = false;
        state.passwordChangeSuccess = true;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.passwordChangeLoading = false;
        state.error = action.payload;
      })
      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.profileUpdateLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profileUpdateLoading = false;
        state.user = { ...state.user, username: action.payload.username };
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.profileUpdateLoading = false;
        state.error = action.payload;
      })
      // Upload Avatar
      .addCase(uploadAvatar.pending, (state) => {
        state.avatarLoading = true;
        state.error = null;
      })
      .addCase(uploadAvatar.fulfilled, (state) => {
        state.avatarLoading = false;
      })
      .addCase(uploadAvatar.rejected, (state, action) => {
        state.avatarLoading = false;
        state.error = action.payload;
      })
      // Fetch Avatar
      .addCase(fetchAvatar.pending, (state) => {
        state.avatarLoading = true;
      })
      .addCase(fetchAvatar.fulfilled, (state, action) => {
        state.avatarLoading = false;
        state.avatar = action.payload.has_avatar ? action.payload.avatar_base64 : null;
      })
      .addCase(fetchAvatar.rejected, (state) => {
        state.avatarLoading = false;
        state.avatar = null;
      });
  },
});

export const { clearError, clearPasswordChangeSuccess, resetAuth } = authSlice.actions;

// Selectors
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;
export const selectIsAdmin = (state) => state.auth.user?.role === 'administrator';
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectSessionVerified = (state) => state.auth.sessionVerified;
export const selectAvatar = (state) => state.auth.avatar;

export default authSlice.reducer;


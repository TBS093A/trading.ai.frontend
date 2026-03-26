import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  logout,
  changePassword,
  updateProfile,
  uploadAvatar,
  fetchAvatar,
  clearError,
  clearPasswordChangeSuccess,
  selectUser,
  selectIsAdmin,
  selectAvatar,
  selectAuthLoading,
  selectAuthError,
} from '../../store/slices/authSlice';
import { setSelectedExchange } from '../../store/slices/exchangesSlice';
import { clearAssets } from '../../store/slices/assetsSlice';
import { clearChart } from '../../store/slices/chartSlice';
import { clearAnalysis } from '../../store/slices/analysisSlice';
import SyncSection from './SyncSection';
import SavedAnalysisSection from './SavedAnalysisSection';
import { validatePassword, sanitizeString, clearCsrfToken } from '../../utils/security';
import './UserSection.css';

const UserSection = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAdmin = useSelector(selectIsAdmin);
  const avatar = useSelector(selectAvatar);
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const passwordChangeSuccess = useSelector((state) => state.auth.passwordChangeSuccess);
  const passwordChangeLoading = useSelector((state) => state.auth.passwordChangeLoading);
  const profileUpdateLoading = useSelector((state) => state.auth.profileUpdateLoading);
  const avatarLoading = useSelector((state) => state.auth.avatarLoading);

  const { list: exchanges, selectedExchange, loading: exchangesLoading } = useSelector((state) => state.exchanges);

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const fileInputRef = useRef(null);

  // Fetch avatar on mount
  useEffect(() => {
    if (user && !avatar) {
      dispatch(fetchAvatar());
    }
  }, [dispatch, user, avatar]);

  // Reset forms when section changes
  useEffect(() => {
    setNewUsername(user?.username || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    dispatch(clearError());
  }, [activeSection, user, dispatch]);

  // Clear password change success message after 3 seconds
  useEffect(() => {
    if (passwordChangeSuccess) {
      const timer = setTimeout(() => {
        dispatch(clearPasswordChangeSuccess());
        setActiveSection(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [passwordChangeSuccess, dispatch]);

  const handleExchangeChange = useCallback((e) => {
    const exchangeId = parseInt(e.target.value);
    const exchange = exchanges.find((ex) => ex.id === exchangeId);
    if (exchange) {
      dispatch(setSelectedExchange(exchange));
      dispatch(clearAssets());
      dispatch(clearChart());
      dispatch(clearAnalysis());
    }
  }, [dispatch, exchanges]);

  const handleLogout = () => {
    clearCsrfToken(); // Clear CSRF token on logout
    dispatch(logout());
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return;
    }
    dispatch(changePassword({ currentPassword, newPassword }));
  };

  const handleUpdateUsername = (e) => {
    e.preventDefault();
    const sanitizedUsername = sanitizeString(newUsername.trim());
    if (sanitizedUsername && sanitizedUsername !== user?.username) {
      dispatch(updateProfile({ username: sanitizedUsername }));
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      dispatch(uploadAvatar(file)).then(() => {
        dispatch(fetchAvatar());
      });
    }
  };

  // Use security utility for password validation
  const passwordValidation = useMemo(() => validatePassword(newPassword), [newPassword]);
  const passwordsMatch = newPassword === confirmPassword;
  const isPasswordValid = passwordValidation.isValid;

  return (
    <div className="user-section-wrapper">
      {/* Main dropdown toggle */}
      <button
        className={`user-dropdown-toggle ${isExpanded ? 'expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="user-avatar-mini">
          {avatar ? (
            <img src={`data:image/jpeg;base64,${avatar}`} alt="Avatar" />
          ) : (
            <span className="avatar-placeholder">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="user-info-mini">
          <span className="user-name">{user?.username || 'Użytkownik'}</span>
          <span className={`user-role ${isAdmin ? 'admin' : 'user'}`}>
            {isAdmin ? 'Administrator' : 'Użytkownik'}
          </span>
        </div>
        <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="user-dropdown-content">
          {/* Exchange Selector */}
          <div className="user-item exchange-item">
            <div className="user-item-header exchange-header">
              <span className="item-icon">⬡</span>
              <span className="item-title">Exchange</span>
            </div>
            <div className="user-item-content exchange-content">
              <select
                className="user-exchange-select"
                value={selectedExchange?.id || ''}
                onChange={handleExchangeChange}
                disabled={exchangesLoading}
              >
                {exchanges.map((exchange) => (
                  <option key={exchange.id} value={exchange.id}>
                    {exchange.display_name || exchange.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Synchronization Section */}
          <SyncSection />

          {/* Saved Analyses Section */}
          <SavedAnalysisSection onClose={() => setIsExpanded(false)} />

          {/* Avatar Section */}
          <div className="user-item">
            <button
              className={`user-item-header ${activeSection === 'avatar' ? 'active' : ''}`}
              onClick={() => setActiveSection(activeSection === 'avatar' ? null : 'avatar')}
            >
              <span className="item-icon">◉</span>
              <span className="item-title">Avatar</span>
              <span className="item-arrow">{activeSection === 'avatar' ? '−' : '+'}</span>
            </button>

            {activeSection === 'avatar' && (
              <div className="user-item-content">
                <div className="avatar-preview-container">
                  <div 
                    className="avatar-preview"
                    onClick={handleAvatarClick}
                    title="Kliknij aby zmienić avatar"
                  >
                    {avatarLoading ? (
                      <span className="avatar-loading">⟳</span>
                    ) : avatar ? (
                      <img src={`data:image/jpeg;base64,${avatar}`} alt="Avatar" />
                    ) : (
                      <span className="avatar-placeholder-large">
                        {user?.username?.charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                    <div className="avatar-overlay">
                      <span>📷</span>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                </div>
                <p className="avatar-hint">Kliknij na avatar aby wgrać nowe zdjęcie</p>
                <p className="avatar-formats">JPG, PNG, GIF, WebP (max 5MB)</p>
              </div>
            )}
          </div>

          {/* Username Section */}
          <div className="user-item">
            <button
              className={`user-item-header ${activeSection === 'username' ? 'active' : ''}`}
              onClick={() => setActiveSection(activeSection === 'username' ? null : 'username')}
            >
              <span className="item-icon">✎</span>
              <span className="item-title">Zmień nazwę</span>
              <span className="item-arrow">{activeSection === 'username' ? '−' : '+'}</span>
            </button>

            {activeSection === 'username' && (
              <div className="user-item-content">
                <form onSubmit={handleUpdateUsername}>
                  <div className="form-field">
                    <label>Nowa nazwa użytkownika</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Wprowadź nową nazwę"
                      minLength={3}
                      maxLength={100}
                    />
                  </div>

                  {error && activeSection === 'username' && (
                    <div className="error-msg">
                      {error}
                      <button type="button" onClick={() => dispatch(clearError())}>×</button>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="user-action-btn"
                    disabled={profileUpdateLoading || !newUsername.trim() || newUsername === user?.username}
                  >
                    {profileUpdateLoading ? '⟳ Zapisywanie...' : '✓ Zapisz'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Password Section */}
          <div className="user-item">
            <button
              className={`user-item-header ${activeSection === 'password' ? 'active' : ''}`}
              onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')}
            >
              <span className="item-icon">⚿</span>
              <span className="item-title">Zmień hasło</span>
              <span className="item-arrow">{activeSection === 'password' ? '−' : '+'}</span>
            </button>

            {activeSection === 'password' && (
              <div className="user-item-content">
                {passwordChangeSuccess ? (
                  <div className="success-msg">
                    <span className="success-icon">✓</span>
                    Hasło zostało zmienione!
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword}>
                    <div className="form-field">
                      <label>Aktualne hasło</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Wprowadź aktualne hasło"
                      />
                    </div>

                    <div className="form-field">
                      <label>Nowe hasło</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 znaków, wielka i mała litera, cyfra"
                        minLength={8}
                      />
                      {newPassword && !isPasswordValid && passwordValidation.errors.length > 0 && (
                        <div className="password-errors">
                          {passwordValidation.errors.map((err, idx) => (
                            <span key={idx} className="field-hint error">{err}</span>
                          ))}
                        </div>
                      )}
                      {newPassword && isPasswordValid && (
                        <span className={`field-hint strength-${passwordValidation.strength}`}>
                          Siła hasła: {passwordValidation.strength === 'strong' ? 'silne' : 
                                       passwordValidation.strength === 'medium' ? 'średnie' : 'słabe'}
                        </span>
                      )}
                    </div>

                    <div className="form-field">
                      <label>Potwierdź hasło</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Powtórz nowe hasło"
                      />
                      {confirmPassword && !passwordsMatch && (
                        <span className="field-hint error">Hasła nie są zgodne</span>
                      )}
                    </div>

                    {error && activeSection === 'password' && (
                      <div className="error-msg">
                        {error}
                        <button type="button" onClick={() => dispatch(clearError())}>×</button>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="user-action-btn"
                      disabled={
                        passwordChangeLoading ||
                        !currentPassword ||
                        !newPassword ||
                        !confirmPassword ||
                        !passwordsMatch ||
                        !isPasswordValid
                      }
                    >
                      {passwordChangeLoading ? '⟳ Zmienianie...' : '⚿ Zmień hasło'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="user-item logout-item">
            <button
              className="user-item-header logout-btn"
              onClick={handleLogout}
              disabled={loading}
            >
              <span className="item-icon">⎋</span>
              <span className="item-title">{loading ? 'Wylogowywanie...' : 'Wyloguj się'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSection;


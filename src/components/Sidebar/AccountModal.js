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
import { setAccountModalOpen } from '../../store/slices/uiSlice';
import { validatePassword, sanitizeString, clearCsrfToken } from '../../utils/security';
import './AccountModal.css';

const AccountModal = () => {
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

  const isOpen = useSelector((state) => state.ui.accountModalOpen);

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

  const handleClose = useCallback(() => {
    setActiveSection(null);
    dispatch(setAccountModalOpen(false));
  }, [dispatch]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

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

  if (!isOpen) return null;

  return (
    <div className="account-modal-overlay" onClick={handleClose}>
      <div
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Ustawienia konta"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="account-modal-header">
          <div
            className="avatar-preview"
            onClick={handleAvatarClick}
            title="Kliknij aby zmienić avatar (JPG, PNG, GIF, WebP, max 5MB)"
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
          <div className="account-identity">
            <span className="user-name">{user?.username || 'Użytkownik'}</span>
            <span className={`user-role ${isAdmin ? 'admin' : 'user'}`}>
              {isAdmin ? 'Administrator' : 'Użytkownik'}
            </span>
          </div>
          <button className="account-modal-close" onClick={handleClose} aria-label="Zamknij">
            ×
          </button>
        </div>

        <div className="account-modal-body">
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
        </div>

        <div className="account-modal-footer">
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
    </div>
  );
};

export default AccountModal;

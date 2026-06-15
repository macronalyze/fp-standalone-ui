import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <h1>FP — Macro Trend Analyzer</h1>
      <p>Sign in to continue</p>
      <div #googleBtn class="google-btn"></div>

      <div *ngIf="devAuth" class="dev-login">
        <div class="dev-divider"><span>dev only</span></div>
        <input
          type="email"
          [(ngModel)]="devEmail"
          placeholder="dev@example.com"
          autocomplete="off"
        />
        <select [(ngModel)]="devRole">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button type="button" (click)="onDevLogin()" [disabled]="!devEmail || devLoading">
          {{ devLoading ? 'Signing in…' : 'Dev sign in' }}
        </button>
        <div *ngIf="devError" class="dev-error">{{ devError }}</div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 85vh;
      gap: 16px;
    }
    h1 { margin: 0; }
    p { color: #666; margin: 0 0 24px; }
    .dev-login {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 260px;
      margin-top: 16px;
    }
    .dev-login input,
    .dev-login select,
    .dev-login button {
      padding: 8px 10px;
      font-size: 14px;
    }
    .dev-divider {
      display: flex;
      align-items: center;
      color: #999;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 8px;
    }
    .dev-divider::before,
    .dev-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e0e0e0;
    }
    .dev-divider span { padding: 0 8px; }
    .dev-error { color: #c0392b; font-size: 12px; }
  `],
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleBtn') googleBtn!: ElementRef;

  devAuth = environment.devAuth === true;
  devEmail = '';
  devRole: 'user' | 'admin' = 'user';
  devLoading = false;
  devError = '';

  constructor(private auth: AuthService) {}

  ngAfterViewInit(): void {
    this.auth.initGoogleSignIn(this.googleBtn.nativeElement);
  }

  onDevLogin(): void {
    if (!this.devEmail) {
      return;
    }
    this.devLoading = true;
    this.devError = '';
    this.auth.devLogin(this.devEmail.trim(), this.devRole).subscribe({
      next: () => {
        this.devLoading = false;
      },
      error: (err) => {
        this.devLoading = false;
        this.devError =
          err?.error?.detail || 'Dev login failed. Is DEV_AUTH=1 on the backend?';
      },
    });
  }
}


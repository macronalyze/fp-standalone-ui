import { Component, inject, HostListener } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <mat-toolbar class="navbar">
      <span class="logo" (click)="goHome()">
        <mat-icon>show_chart</mat-icon>
        <span class="app-name">FP</span>
      </span>

      <span class="spacer"></span>

      <button mat-icon-button (click)="themeService.toggle()" [matTooltip]="themeService.isDark() ? 'Switch to light' : 'Switch to dark'">
        <mat-icon>{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>

      @if (auth.user$ | async; as user) {
        <div class="user-menu-wrapper">
          <button mat-icon-button (click)="toggleMenu($event)" [matTooltip]="user.name">
            @if (user.picture && !pictureError) {
              <img [src]="user.picture" class="user-avatar" referrerpolicy="no-referrer" (error)="pictureError = true" />
            } @else {
              <mat-icon>account_circle</mat-icon>
            }
          </button>
          @if (menuOpen) {
            <div class="dropdown-menu">
              <div class="user-info">
                <strong>{{ user.name }}</strong>
                <small>{{ user.email }}</small>
                <span class="role-badge">{{ user.role }}</span>
              </div>
              <button class="menu-item" (click)="logout()">
                <mat-icon>logout</mat-icon>
                <span>Sign out</span>
              </button>
            </div>
          }
        </div>
      }
    </mat-toolbar>
  `,
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .navbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 24px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-weight: 500;
      font-size: 1.2rem;
    }
    .spacer {
      flex: 1;
    }
    .user-menu-wrapper button[mat-icon-button] {
      overflow: hidden;
      padding: 0;
    }
    .user-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      display: block;
    }
    .user-menu-wrapper {
      position: relative;
    }
    .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      min-width: 220px;
      background: var(--mat-toolbar-container-background-color, #424242);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      z-index: 1000;
    }
    .user-info {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-bottom: 1px solid rgba(128, 128, 128, 0.3);
    }
    .user-info small { opacity: 0.7; }
    .role-badge {
      font-size: 11px;
      text-transform: uppercase;
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 8px;
      border-radius: 12px;
      width: fit-content;
      margin-top: 4px;
    }
    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: none;
      color: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .menu-item:hover {
      background: rgba(128, 128, 128, 0.2);
    }
  `]
})
export class NavbarComponent {
  themeService = inject(ThemeService);
  auth = inject(AuthService);
  private router = inject(Router);
  pictureError = false;
  menuOpen = false;

  @HostListener('document:click')
  onDocumentClick(): void {
    this.menuOpen = false;
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  logout(): void {
    this.menuOpen = false;
    this.auth.logout();
  }

  goHome(): void {
    this.router.navigate(['/countries']);
  }
}

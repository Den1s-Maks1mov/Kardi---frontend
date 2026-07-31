import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {RevealDirective} from '../../shared/directives/reveal';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, RouterModule, RevealDirective],
  templateUrl: './error-page.html',
  styleUrls: ['./error-page.scss']
})
export class ErrorPageComponent {
}

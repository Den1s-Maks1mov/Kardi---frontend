import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import { RouterModule } from '@angular/router';
import { FaqAccordionComponent } from '../../components/faqaccordion/fac-accordion';
import { RevealDirective } from '../../shared/directives/reveal';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FaqAccordionComponent, RevealDirective],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})

export class HomeComponent  {

}

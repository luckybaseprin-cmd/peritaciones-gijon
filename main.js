// js/main.js

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('mobile-active');
    });
  }

  // 2. Header Scroll Effect
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 3. Scroll Reveal Animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        // trigger counter if it's a stat
        const counters = entry.target.querySelectorAll('.stat-number');
        if (counters.length > 0) {
          counters.forEach(counter => animateValue(counter, 0, parseInt(counter.dataset.target), 2000));
          observer.unobserve(entry.target); // only animate once
        }
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  
  // also observe explicitly the hero-stats div if it doesnt have reveal class
  const heroStats = document.querySelector('.hero-stats');
  if(heroStats && !heroStats.classList.contains('reveal')) {
      observer.observe(heroStats);
  }

  // 4. Number Counters Animation
  function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      obj.innerHTML = Math.floor(ease * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        obj.innerHTML = end;
      }
    };
    window.requestAnimationFrame(step);
  }

  // 5. Testimonial Slider
  const track = document.getElementById('testimonialsTrack');
  const prevBtn = document.getElementById('prevTestimonial');
  const nextBtn = document.getElementById('nextTestimonial');
  const dotsContainer = document.getElementById('testimonialDots');
  
  if(track && prevBtn && nextBtn && dotsContainer) {
      const cards = Array.from(track.children);
      const cardWidth = cards[0].getBoundingClientRect().width;
      const gap = parseInt(window.getComputedStyle(track).gap) || 32;
      let currentIndex = 0;
      
      // build dots
      cards.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        if(i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => moveTo(i));
        dotsContainer.appendChild(dot);
      });
      
      const dots = Array.from(dotsContainer.children);

      function updateDots(index) {
          dots.forEach(d => d.classList.remove('active'));
          dots[index].classList.add('active');
      }

      function moveTo(index) {
          if(index < 0 || index > cards.length - 1) return;
          currentIndex = index;
          const amountToMove = currentIndex * (cardWidth + gap);
          track.style.transform = `translateX(-${amountToMove}px)`;
          updateDots(currentIndex);
      }

      nextBtn.addEventListener('click', () => {
          if (currentIndex < cards.length - 1) {
             moveTo(currentIndex + 1);
          } else {
             moveTo(0); // loop back
          }
      });

      prevBtn.addEventListener('click', () => {
          if (currentIndex > 0) {
              moveTo(currentIndex - 1);
          } else {
              moveTo(cards.length - 1); // loop end
          }
      });
      
      // optional auto slider
      let slideInterval = setInterval(() => { nextBtn.click(); }, 5000);
      
      track.addEventListener('mouseenter', () => clearInterval(slideInterval));
      track.addEventListener('mouseleave', () => {
          slideInterval = setInterval(() => { nextBtn.click(); }, 5000);
      });
  }

  // 6. Cookie Banner
  const cookieBanner = document.getElementById('cookieBanner');
  const btnAccept = document.getElementById('cookieAccept');
  const btnReject = document.getElementById('cookieReject');

  if (cookieBanner && btnAccept && btnReject) {
    if (!localStorage.getItem('cookiesAccepted')) {
      setTimeout(() => {
        cookieBanner.classList.add('show');
      }, 2000);
    }

    btnAccept.addEventListener('click', () => {
      localStorage.setItem('cookiesAccepted', 'true');
      cookieBanner.classList.remove('show');
    });

    btnReject.addEventListener('click', () => {
      localStorage.setItem('cookiesAccepted', 'false');
      cookieBanner.classList.remove('show');
    });
  }

  // 7. Particle Background Effect
  const particlesContainer = document.getElementById('particles');
  if (particlesContainer) {
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
      createParticle();
    }
    
    function createParticle() {
      const particle = document.createElement('div');
      particle.classList.add('particle');
      
      const size = Math.random() * 5 + 2;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      
      // Random colors for particles: blue or amber
      const isBlue = Math.random() > 0.5;
      if (!isBlue) {
        particle.style.background = 'var(--accent-amber)';
        particle.style.boxShadow = '0 0 10px var(--accent-amber)';
      }
      
      const duration = Math.random() * 20 + 10;
      particle.style.animation = `particleFloat ${duration}s infinite linear`;
      particle.style.animationDelay = `${Math.random() * 5}s`;
      
      particlesContainer.appendChild(particle);
    }
  }
  
  // Custom Card Hover Logic (Glassmorphism highlight)
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
});

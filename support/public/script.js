document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const submitButton = form.querySelector('.submit-button');
  const formStatus = document.getElementById('formStatus');
  
  // Disable button and show loading
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  formStatus.className = 'form-status';
  formStatus.style.display = 'none';
  
  // Get form data
  const formData = {
    name: form.name.value,
    email: form.email.value,
    subject: form.subject.value,
    message: form.message.value,
  };
  
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    
    if (response.ok) {
      formStatus.className = 'form-status success';
      formStatus.textContent = 'Message sent successfully! We\'ll get back to you soon.';
      form.reset();
    } else {
      throw new Error('Failed to send message');
    }
  } catch (error) {
    formStatus.className = 'form-status error';
    formStatus.textContent = 'Failed to send message. Please try again or email us directly at aasim.ss@gmail.com';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send Message';
  }
});

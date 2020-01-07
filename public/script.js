(function() {
    'use strict';

    window.addEventListener('load', function() {
        const forms = document.getElementsByClassName('needs-validation');

        Array.prototype.filter.call(forms, form => {
            form.addEventListener('submit', event => {
                if (form.checkValidity() === false) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                form.classList.add('was-validated');
            }, false);
        });

        const confirmPasswordInput = document.querySelector('input[name="confirmPassword"]');

        if (confirmPasswordInput) {
            const passwordInput = document.querySelector('input[name="password"]');

            confirmPasswordInput.addEventListener('change', () => {
                if (passwordInput.value === confirmPasswordInput.value) {
                    confirmPasswordInput.setCustomValidity('');
                    return;
                }

                confirmPasswordInput.setCustomValidity('Passwords do not match');
            });
        }
    }, false);
})();

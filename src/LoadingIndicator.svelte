<script>
  export let message = 'Loading...';
</script>

<div class="loading-container">
  <div class="spinner"></div>
  <p class="message">{message}</p>
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .message {
    margin-top: 24px;
    color: white;
    font-size: 18px;
    font-weight: 500;
  }
</style>










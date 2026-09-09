// Basic deployment validation test
describe('Deployment Configurations', () => {
  it('should have Dockerfile', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'Dockerfile'))).toBe(true);
  });

  it('should have docker-compose.yml', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'docker-compose.yml'))).toBe(true);
  });

  it('should have .env.example', () => {
    expect(fs.existsSync(path.join(__dirname, '..', '.env.example'))).toBe(true);
  });
});
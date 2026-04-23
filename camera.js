export class GameCamera {
  constructor() {
    this.position = [0, 1.0, 16];
    this.yaw = Math.PI;
    this.pitch = 0;
    this.speed = 5.5;
    this.turnSpeed = 2.2;
    this.jumpSpeed = 5.6;
    this.gravity = 15;
    this.velY = 0;
    this.isJumping = false;
    this.groundY = 1.0;
  }

  jump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.velY = this.jumpSpeed;
    }
  }

  updateFromKeys(keys, dt, moveAndCollide) {
    let dx = 0;
    let dz = 0;

    if (keys.w) {
      dx -= this.speed * Math.sin(this.yaw) * dt;
      dz -= this.speed * Math.cos(this.yaw) * dt;
    }
    if (keys.s) {
      dx += this.speed * Math.sin(this.yaw) * dt;
      dz += this.speed * Math.cos(this.yaw) * dt;
    }
    if (keys.a) {
      dx -= this.speed * Math.cos(this.yaw) * dt;
      dz += this.speed * Math.sin(this.yaw) * dt;
    }
    if (keys.d) {
      dx += this.speed * Math.cos(this.yaw) * dt;
      dz -= this.speed * Math.sin(this.yaw) * dt;
    }

    if (keys.turnLeft) this.yaw += this.turnSpeed * dt;
    if (keys.turnRight) this.yaw -= this.turnSpeed * dt;

    if (moveAndCollide) moveAndCollide(dx, dz);

    if (this.isJumping) {
      this.position[1] += this.velY * dt;
      this.velY -= this.gravity * dt;
      if (this.position[1] <= this.groundY) {
        this.position[1] = this.groundY;
        this.isJumping = false;
        this.velY = 0;
      }
    }
  }
}

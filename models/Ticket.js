const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ticketNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'),
    defaultValue: 'pending'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  purchaseDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  EventId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Events',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: (ticket) => {
      // Generate unique ticket number
      ticket.ticketNumber = 'TKT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
  }
});

module.exports = Ticket;

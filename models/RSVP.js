const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RSVP = sequelize.define('RSVP', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'),
    defaultValue: 'pending'
  },
  numberOfSeats: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  specialRequirements: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  responseDate: {
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
    beforeCreate: async (rsvp) => {
      // Check if there are enough seats available
      const event = await sequelize.models.Event.findByPk(rsvp.EventId);
      const currentRSVPs = await RSVP.sum('numberOfSeats', {
        where: {
          EventId: rsvp.EventId,
          status: 'confirmed'
        }
      });
      
      if (event.capacity < (currentRSVPs + rsvp.numberOfSeats)) {
        throw new Error('Not enough seats available');
      }
    }
  }
});

module.exports = RSVP; 
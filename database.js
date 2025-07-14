const mongoose = require('mongoose');
require('dotenv').config();

// Схема для декларации
const declarationSchema = new mongoose.Schema({
  declID: String,
  totalPrice: Number,
  totalWeight: Number,
  lastName: String,
  firstName: String,
  passport: String,
  pnfl: String,
  createdAt: { type: Date, default: Date.now }
});

// Схема для ПНФЛ
const pnflSchema = new mongoose.Schema({
  pnfl: String,
  declarations: [declarationSchema]
});

// Схема для рейса
const flightSchema = new mongoose.Schema({
  country: String,
  date: Date,
  pnflData: [pnflSchema]
});

const Flight = mongoose.model('Flight', flightSchema);

class Database {
  constructor() {
    this.connect();
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
    }
  }

  async addDeclarationToFlight(country, data) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Найти или создать рейс для текущей даты и страны
      let flight = await Flight.findOne({
        country: country,
        date: today
      });

      if (!flight) {
        flight = new Flight({
          country: country,
          date: today,
          pnflData: []
        });
      }

      // Найти ПНФЛ в текущем рейсе
      let pnflEntry = flight.pnflData.find(p => p.pnfl === data.pnfl);
      
      if (!pnflEntry) {
        // Если ПНФЛ не найден, создаем новый
        pnflEntry = {
          pnfl: data.pnfl,
          declarations: []
        };
        flight.pnflData.push(pnflEntry);
      }

      // Добавляем декларацию
      pnflEntry.declarations.push({
        declID: data.declID,
        totalPrice: data.totalPrice,
        totalWeight: data.totalWeight,
        lastName: data.lastName,
        firstName: data.firstName,
        passport: data.passport,
        pnfl: data.pnfl,
        createdAt: new Date()
      });

      // await flight.save();
      return true;
    } catch (error) {
      console.error('Error adding declaration:', error);
      return false;
    }
  }
}

module.exports = new Database();

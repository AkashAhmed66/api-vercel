const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  rater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  categories: {
    punctuality: {
      type: Number,
      min: 1,
      max: 5
    },
    cleanliness: {
      type: Number,
      min: 1,
      max: 5
    },
    courtesy: {
      type: Number,
      min: 1,
      max: 5
    },
    safety: {
      type: Number,
      min: 1,
      max: 5
    }
  }
}, {
  timestamps: true
});

// Create compound index to ensure a user can only rate once per ride
ratingSchema.index({ ride: 1, rater: 1 }, { unique: true });

// Create index for efficient querying by rated user
ratingSchema.index({ rated: 1 });

// Static method to calculate average rating for a user
ratingSchema.statics.calculateAverageRating = async function(userId) {
  const result = await this.aggregate([
    {
      $match: { rated: mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: '$rated',
        averageRating: { $avg: '$score' },
        totalRatings: { $sum: 1 },
        categories: {
          $push: '$categories'
        }
      }
    }
  ]);
  
  if (result.length === 0) {
    return {
      averageRating: 0,
      totalRatings: 0,
      categories: {
        punctuality: 0,
        cleanliness: 0,
        courtesy: 0,
        safety: 0
      }
    };
  }
  
  // Calculate average for each category
  const categoryAverages = {
    punctuality: 0,
    cleanliness: 0,
    courtesy: 0,
    safety: 0
  };
  
  let categoryCount = {
    punctuality: 0,
    cleanliness: 0,
    courtesy: 0,
    safety: 0
  };
  
  // Calculate sum of all category ratings
  result[0].categories.forEach(category => {
    if (category) {
      Object.keys(categoryAverages).forEach(key => {
        if (category[key]) {
          categoryAverages[key] += category[key];
          categoryCount[key]++;
        }
      });
    }
  });
  
  // Calculate average for each category
  Object.keys(categoryAverages).forEach(key => {
    if (categoryCount[key] > 0) {
      categoryAverages[key] = categoryAverages[key] / categoryCount[key];
    }
  });
  
  return {
    averageRating: result[0].averageRating,
    totalRatings: result[0].totalRatings,
    categories: categoryAverages
  };
};

// Update user's average rating
ratingSchema.post('save', async function() {
  const Rating = this.constructor;
  const User = mongoose.model('User');
  
  const ratingStats = await Rating.calculateAverageRating(this.rated);
  
  // Update user with new rating info
  await User.findByIdAndUpdate(this.rated, {
    'rating.average': ratingStats.averageRating,
    'rating.count': ratingStats.totalRatings
  });
});

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating; 
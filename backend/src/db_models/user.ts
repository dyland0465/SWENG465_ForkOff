import mongoose, { Schema } from "mongoose";
import { applicantRoleOptions, businessTypeOptions, cuisineOptions, priceLevelOptions, serviceOptions } from "../utils/partnerApplication";

const userSchema = new Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "partner", "admin"], default: "user" },
  restaurantIds: { type: [{ type: Schema.Types.ObjectId, ref: "Restaurant" }], default: [] },
  partnerStatus: { type: String, enum: ["pending", "approved", "rejected"] },
  // partner stuff: 
  requestedRestaurant: {
    name: { type: String, trim: true },
    address: { type: String, trim: true },    // street address
    city: { type: String, trim: true },
    state: { type: String, trim: true },      // 2-letter code, ex "PA"
    postalCode: { type: String, trim: true },
    phone: { type: String, trim: true },      
    website: { type: String, trim: true },
    cuisine: { type: String, enum: [...cuisineOptions] },
    priceLevel: { type: String, enum: [...priceLevelOptions] },
    businessType: { type: String, enum: [...businessTypeOptions] },
    serviceOptions: { type: [{ type: String, enum: [...serviceOptions] }], default: undefined },
    applicantRole: { type: String, enum: [...applicantRoleOptions] }, // the applicant's role at the restaurant
    notes: { type: String, trim: true },
  },
  // When the partner confirmed they are authorized to represent the restaurant.
  partnerAgreedAt: { type: Date },
}, {
  timestamps: true
}
);

// changed it to use users in mongodb instead of user
export const User = mongoose.model("User", userSchema, "users");
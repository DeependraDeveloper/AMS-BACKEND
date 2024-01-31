import mongoose from "mongoose";

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        required: true,
        enum: ['admin', 'employee'],
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unqiue: true
    },
    password: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: Number,
        required: true,
        trim: true,
        unqiue: true
    },
    address: {
        type: String,
        required: false,
        trim: true,
    },
    department: {
        type: String,
        required: false,
        enum: ['IT', 'HR', 'Marketing', 'Sales', 'Finance', 'Operations', 'Design', 'Others'],
        trim: true,
    },
    designation: {
        type: String,
        required: false,
        enum: ['Manager', 'Team Lead', 'Developer', 'Designer', 'Tester', 'Others'],
        trim: true,
    },
    organization: {
        type: String,
        required: false,
        trim: true,
    },
    rollno: {
        type: Number,
        trim: true,
    },
}, {
    timestamps: true,
    versionKey: false
});

const User = mongoose.model('User', userSchema);

// roll no should be added before saving the user starting from 1 and incrementing by 1 for each new user and should be unique
userSchema.pre("save", async function (next) {
    if (!this.isNew) return next();
    try {
        // Find the highest existing serial number
        const highestRollNo = await this.constructor
            .findOne()
            .sort("-rollno")
            .exec();

        this.serialNo = highestRollNo ? highestRollNo.rollno + 1 : 1;
        next();
    } catch (error) {
        next(error);
    }
});


export default User;
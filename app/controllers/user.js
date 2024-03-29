import User from '../models/user.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { calculateTimeDifference, isEmail, isPhone, isValid, isValidRequestBody } from '../utils/common_func.js';
import Attendence from '../models/attendence.js';
import Leave from '../models/leave.js';
import { createObjectCsvWriter } from 'csv-writer';
import { isValidObjectId } from 'mongoose';


// signup
export const signup = async (req, res) => {
    /*
       enum: ['admin', 'employee'], role - > radio button
       enum: ['IT', 'HR', 'Marketing', 'Sales', 'Finance', 'Operations', 'Design', 'Others'], -> dropdown and custom input
       enum: ['Manager', 'Team Lead', 'Developer', 'Designer', 'Tester', 'Others'], -> dropdown and custom input


    */
    try {
        let {
            name,
            email,
            password,
            phone,
            department,
            designation,
            organization,
        } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');
        if (!isValid(name)) throw new Error('Name is required');
        if (!isValid(email)) throw new Error('Email is required');
        if (!isEmail(email)) throw new Error('Invalid email.');
        if (!isValid(password)) throw new Error('Password is required');
        if (!isValid(phone)) throw new Error('Phone is required');
        if (!isPhone(phone)) throw new Error('Invalid phone number.');
        if (!isValid(department)) throw new Error('Department is required');
        if (!isValid(designation)) throw new Error('Designation is required');
        if (!isValid(organization)) throw new Error('Organization is required');


        // CHECK PHONE AND EMAIL IS ALREADY REGISTERED OR NOT

        let isPhoneRegistered = await User.findOne({ phone: phone });
        if (isPhoneRegistered) throw new Error('Phone is already registered');

        let isEmailRegistered = await User.findOne({ email: email });
        if (isEmailRegistered) throw new Error('Email is already registered');

        let isOrganizationRegistered = await User.findOne({ organization: organization });
        if (isOrganizationRegistered) throw new Error('Organization is already registered');

        let hassedPassword = await bcrypt.hash(password, 10);

        req.body.password = hassedPassword;
        req.body.profilePic = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTTY16sfbiF4kBV6bdqExoUBrDf3Qfna4d8kg&usqp=CAU';

        const newUser = new User(req.body);


        let user = await User.create(newUser);

        let token = jwt.sign({ id: user._id, role: user.role }, 'SECRET101', { expiresIn: '50d' });
        // COPY USER OBJECT AND ADD TOKEN TO IT
        let copyOfUser = user.toObject();
        copyOfUser.token = token;

        return res.status(200).json(copyOfUser);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// singnin
export const signin = async (req, res) => {
    try {
        let { phone, password } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');

        if (!isValid(phone)) throw new Error('Phone is required.');
        if (!isPhone(phone)) throw new Error('Invalid phone number.');
        if (!isValid(password)) throw new Error('Password is required.');


        let user = await User.findOne({ phone: phone });
        if (!user) throw new Error('User not found');

        let isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error('Invalid credentials');

        // lets create jwt token for the user
        let token = jwt.sign({ id: user._id, role: user.role }, 'SECRET101', { expiresIn: '50d' });

        let copyOfUser = user.toObject();
        copyOfUser.token = token;

        return res.status(200).json(copyOfUser);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }

};


// reset password
export const resetPassword = async (req, res) => {
    try {
        let { phone, password, confirmPassword } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');

        if (!isValid(phone)) throw new Error('Phone is required.');
        if (!isPhone(phone)) throw new Error('Invalid phone number.');
        if (!isValid(password)) throw new Error('Password is required.');
        if (!isValid(confirmPassword)) throw new Error('Confirm Password is required.');

        if (password !== confirmPassword) throw new Error('Password and Confirm Password must be same.');

        let hassedPassword = await bcrypt.hash(password, 10);

        let user = await User.findOneAndUpdate({ phone: phone }, { password: hassedPassword }, { new: true });
        if (!user) throw new Error('User not found');

        return res.status(200).json(user);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// clock in and out
export const clockInOut = async (req, res) => {
    try {
        let { id, time } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');

        let user = await User.findOne({ _id: id });
        if (!user) throw new Error('User not found');

        // findTodayAttendence
        let startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);


        let todayAttendence = await Attendence.findOne({ user: id, createdAt: { $gte: startOfDay, $lt: endOfDay } }).populate('user');

        if (todayAttendence && todayAttendence?.inTime !== undefined && todayAttendence?.outTime !== undefined && todayAttendence?.outTime !== "") {
            throw new Error('You have already clocked in and out for today.\nPlease try again tomorrow.');
        }

        if (todayAttendence) {
            let duration = calculateTimeDifference(todayAttendence.inTime, time);
            let clockOut = await Attendence.findOneAndUpdate({ user: id, createdAt: { $gte: startOfDay, $lt: endOfDay } }, { outTime: time, duration: duration }, { new: true });
            return res.status(200).json({ message: 'Clocked out successfully' });
        }

        let clockIn = await Attendence.create({ user: id, inTime: time, status: 'present' });

        return res.status(200).json({ message: 'Clocked in successfully' });
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// Get all attendence of user
export const getTodayAttendence = async (req, res) => {
    try {
        const id = req.params.id;
        // findTodayAttendence
        let startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        let todayAttendence = await Attendence.findOne({ user: id, createdAt: { $gte: startOfDay, $lte: endOfDay } }).populate('user');

        if (!todayAttendence) return res.status(200).json({});
        return res.status(200).json(todayAttendence);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// Add leave request
export const addLeaveRequest = async (req, res) => {
    try {
        let { leaveType, leaveReason, leaveFrom, leaveTo, id } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');

        if (!isValid(leaveType)) throw new Error('Leave Type is required');
        if (!isValid(leaveReason)) throw new Error('Leave Reason is required');
        if (!isValid(leaveFrom)) throw new Error('Leave From is required');
        if (!isValid(leaveTo)) throw new Error('Leave To is required');
        if (!isValid(id)) throw new Error('Leave Applied By is required');

        let leave = await Leave.create({
            leaveType: leaveType,
            leaveReason: leaveReason,
            leaveFrom: leaveFrom,
            leaveTo: leaveTo,
            leaveAppliedBy: id
        });
        return res.status(200).json({ message: 'Leave request submitted successfully!' });
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// Get all leave requests of user

export const getAllLeaveRequests = async (req, res) => {
    try {
        const id = req.params.id;

        let findUser = await User.findOne({ _id: id });

        if (findUser.role === 'company') {
            console.log('user is company');
            // find all leave requests of that company
            let users = await User.find({ organization: findUser.organization });

            let userIds = users.map(user => user._id);

            let leaveRequests = await Leave.find({ leaveAppliedBy: { $in: userIds } }).populate('leaveAppliedBy').sort({ createdAt: -1 })

            if (!leaveRequests) leaveRequests = [];

            return res.status(200).json(leaveRequests);
        }

        console.log('user is not company');

        let leaveRequests = await Leave.find({ leaveAppliedBy: id }).populate('leaveAppliedBy').sort({ createdAt: -1 });

        if (!leaveRequests) leaveRequests = [];
        return res.status(200).json(leaveRequests);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// add users 
export const addUser = async (req, res) => {
    /*
       enum: ['admin', 'employee'], role - > radio button
       enum: ['IT', 'HR', 'Marketing', 'Sales', 'Finance', 'Operations', 'Design', 'Others'], -> dropdown and custom input
       enum: ['Manager', 'Team Lead', 'Developer', 'Designer', 'Tester', 'Others'], -> dropdown and custom input
    */
    try {
        let {
            id,
            name,
            email,
            password,
            phone,
            department,
            designation,
        } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');
        if (!isValid(name)) throw new Error('Name is required');
        if (!isValid(email)) throw new Error('Email is required');
        if (!isEmail(email)) throw new Error('Invalid email.');
        if (!isValid(password)) throw new Error('Password is required');
        if (!isValid(phone)) throw new Error('Phone is required');
        if (!isPhone(phone)) throw new Error('Invalid phone number.');
        if (!isValid(department)) throw new Error('Department is required');
        if (!isValid(designation)) throw new Error('Designation is required');

        // CHECK PHONE AND EMAIL IS ALREADY REGISTERED OR NOT

        let isPhoneRegistered = await User.findOne({ phone: phone });
        if (isPhoneRegistered) throw new Error('Phone is already registered');

        let isEmailRegistered = await User.findOne({ email: email });
        if (isEmailRegistered) throw new Error('Email is already registered');

        let findOrganization = await User.findOne({ _id: id });
        if (!findOrganization) throw new Error('User not found');

        let hassedPassword = await bcrypt.hash(password, 10);

        req.body.password = hassedPassword;
        req.body.role = "employee";
        req.body.organization = findOrganization.organization;
        req.body.profilePic = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcReFuNVUscuscAPv7N7laen4v8CC5cb99ZDvi6d_N_-htu6NwOmNSBic_UuZWQAn2YsSP4&usqp=CAU';

        const newUser = new User(req.body);


        let user = await User.create(newUser);

        let token = jwt.sign({ id: user._id, role: user.role }, 'SECRET101', { expiresIn: '50d' });
        // COPY USER OBJECT AND ADD TOKEN TO IT
        let copyOfUser = user.toObject();
        copyOfUser.token = token;

        return res.status(200).json({ message: 'User added successfully!' });
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// get all attendence of user
export const getAllAttendence = async (req, res) => {
    try {
        const id = req.params.id;

        let attendences = await Attendence.find({ user: id })
            .populate('user')
            .sort({ createdAt: -1 });

        if (!attendences) attendences = [];
        return res.status(200).json(attendences);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// get all users of company
export const getAllUsers = async (req, res) => {
    try {
        const organization = req.params.organization;

        let users = await User.find({ organization: organization, role: 'employee' });

        if (!users) users = [];
        return res.status(200).json(users);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};

// update user
export const updateUser = async (req, res) => {
    try {

        let {
            id,
            name,
            email,
            phone,
            department,
            designation,
            organization,
        } = req.body;

        let updateObj = {};

        if (isValid(name)) updateObj.name = name;
        if (isValid(email)) updateObj.email = email;
        if (isValid(phone)) updateObj.phone = phone;
        if (isValid(department)) updateObj.department = department;
        if (isValid(designation)) updateObj.designation = designation;
        if (isValid(organization)) updateObj.organization = organization;

        await User.findOneAndUpdate({ _id: id }, { $set: updateObj }, { new: true });

        return res.status(200).json({ message: 'User updated successfully!' });

    } catch (error) {
        return res.status(400).json({ message: err.message });
    }
};


// get user 

export const getUser = async (req, res) => {
    try {
        const id = req.params.id;

        let user = await User.findOne({ _id: id });

        if (!user) throw new Error('User not found');

        return res.status(200).json(user);
    }
    catch (err) {
        return res.status(400).json({ message: err.message });
    }
}



// approve or reject leave

export const approveRejectLeave = async (req, res) => {
    try {
        const { leaveId, userId } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');

        let leave = await Leave.findOne({ _id: leaveId });

        if (!leave) throw new Error('Leave not found');

        const { leaveStatus: status } = leave;

        if (status === 'Pending') {
            let updatedLeave = await Leave.findOneAndUpdate({ _id: leaveId }, { leaveStatus: 'Approved', leaveApprovedBy: userId, leaveApprovedOn: new Date() }, { new: true });
            return res.status(200).json({ message: 'Leave approved successfully!' });
        }

        if (status === 'Approved') {
            let updatedLeave = await Leave.findOneAndUpdate({ _id: leaveId }, { leaveStatus: 'Rejected', leaveApprovedBy: userId, leaveApprovedOn: new Date() }, { new: true });
            return res.status(200).json({ message: 'Leave rejected successfully!' });
        }

        if (status === 'Rejected') {
            let updatedLeave = await Leave.findOneAndUpdate({ _id: leaveId }, { leaveStatus: 'Approved', leaveApprovedBy: userId, leaveApprovedOn: new Date() }, { new: true });
            return res.status(200).json({ message: 'Leave approved successfully!' });
        }

        return res.status(200).json({ message: 'Leave status updated successfully!' });

    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// get attendence csv

export const attendenceCsv = async (req, res) => {
    try {

        const id = req.params.id;

        let findCompany = await User.findOne({ _id: id });


        if (!findCompany) throw new Error('User not found');

        let findEmployees = await User.find({ organization: findCompany.organization, role: 'employee' });
        let employeeIds = findEmployees.map(employee => employee._id);

        let attendences = await Attendence.find({
            user: {
                $in: employeeIds
            }
        }).populate("user");

        if (!attendences) attendences = [];

        const csvWriter = createObjectCsvWriter({
            path: "attendence.csv",
            header: [
                { id: "date", title: "DATE" },
                { id: "employee", title: "EMPLOYEE" },
                { id: "phone", title: "PHONE" },
                { id: "inTime", title: "IN TIME" },
                { id: "outTime", title: "OUT TIME" },
                { id: "duration", title: "DURATION" },
                { id: "status", title: "STATUS" }
            ],
        });

        let finalAttendenceData = [];


        for (let attende of attendences) {
            let details = {};
            let { user, createdAt, status, inTime, outTime, duration } = attende;


            details.date = createdAt.toLocaleDateString();

            details.employee = user?.name ?? "N/A";

            details.phone = user?.phone ?? "N/A";

            details.inTime = inTime;

            details.outTime = outTime;

            details.duration = duration;

            details.status = status;


            finalAttendenceData.push(details);
            details = {};
        }

        await csvWriter.writeRecords(finalAttendenceData);
        return res.download("attendence.csv");
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};

// get attendence by month and year
export const getAttendenceByMonthYear = async (req, res) => {
    try {
        const { id } = req.params;

        const findAllAttendences = await Attendence.find({ user: id })
            .populate("user")
            .sort({ createdAt: 1 });

        let attendenceData = [];

        // Group attendances by month and year
        const groupedAttendances = findAllAttendences.reduce((acc, attendence) => {
            const { createdAt } = attendence;
            const month = createdAt.getMonth();
            const year = createdAt.getFullYear();
            const key = `${month}-${year}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(attendence);
            return acc;
        }, {});

        // Create an array of objects with month, year and attendences
        for (const key in groupedAttendances) {
            if (groupedAttendances.hasOwnProperty(key)) {
                const [month, year] = key.split('-');
                const attendences = groupedAttendances[key].map(attendance => attendance);
                attendenceData.push({
                    month: parseInt(month) + 1,
                    year: parseInt(year),
                    attendences
                });
            }
        }

        return res.status(200).json(attendenceData);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}

// update attendence

export const updateAttendence = async (req, res) => {
    try {

        const { id, inTime, outTime, status } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');

        let updateObj = {};

        if (isValid(status)) updateObj.status = status;
        if (isValid(inTime)) {
            let duration = calculateTimeDifference(inTime, outTime);
            updateObj.inTime = inTime;
            updateObj.duration = duration;
        }
        if (isValid(outTime)) {
            let duration = calculateTimeDifference(inTime, outTime);
            updateObj.outTime = outTime;
            updateObj.duration = duration;
        }
        if (isValid(inTime) && isValid(outTime)) {
            let duration = calculateTimeDifference(inTime, outTime);
            updateObj.duration = duration;
        }

        await Attendence.findOneAndUpdate({ _id: id }, { $set: updateObj }, { new: true });

        return res.status(200).json({ message: 'Attendence updated successfully!' });

    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};



// get attendence csv

export const attendenceCsvMonthWise = async (req, res) => {
    try {

        let { id, month, year } = req.body;

        month = parseInt(month);
        year = parseInt(year);

        let startDate = new Date(year, month - 1, 1);
        startDate.setHours(0, 0, 0, 0);

        let endDate = new Date(year, month, 1);
        endDate.setHours(23, 59, 59, 999);

        let attendences = await Attendence.find({
            user: id,
            createdAt: {
                $gt: startDate,
                $lt: endDate
            }
        }).populate("user");

        if (!attendences) attendences = [];

        const csvWriter = createObjectCsvWriter({
            path: "attendenceMonthWise.csv",
            header: [
                { id: "date", title: "DATE" },
                { id: "employee", title: "EMPLOYEE" },
                { id: "phone", title: "PHONE" },
                { id: "inTime", title: "IN TIME" },
                { id: "outTime", title: "OUT TIME" },
                { id: "duration", title: "DURATION" },
                { id: "status", title: "STATUS" }
            ],
        });

        let finalAttendenceData = [];


        for (let attende of attendences) {
            let details = {};
            let { user, createdAt, status, inTime, outTime, duration } = attende;


            details.date = createdAt.toLocaleDateString();

            details.employee = user?.name ?? "N/A";

            details.phone = user?.phone ?? "N/A";

            details.inTime = inTime;

            details.outTime = outTime;

            details.duration = duration;

            details.status = status;


            finalAttendenceData.push(details);
            details = {};
        }

        await csvWriter.writeRecords(finalAttendenceData);
        return res.download("attendenceMonthWise.csv");
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};


// get attendence by date range
export const getAttendenceByDateRange = async (req, res) => {
    try {
        let {
            id,
            startDate,
            endDate
        } = req.body;


        if (!isValid(id)) throw new Error('User id is required');
        if (!isValidObjectId(id)) throw new Error('Invalid user id');
        if (!isValid(startDate) || !isValid(endDate)) throw new Error('Either start date or end date is missing');

        if (isValid(startDate)) {
            startDate = new Date(startDate);
            startDate.setHours(0, 0, 0, 0);
        }

        if (isValid(endDate)) {
            endDate = new Date(endDate);
            endDate.setHours(23, 59, 59, 999);
        }

        let findCompany = await User.findOne({ _id: id });
        if (!findCompany) throw new Error('User not found');

        let findEmployees = await User.find({ organization: findCompany.organization, role: 'employee' });
        let employeeIds = findEmployees.map(employee => employee._id);

        let dateQuery = {};

        if (isValid(startDate) && isValid(endDate)) {
            dateQuery = {
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            }
        }

        if (isValid(startDate) && !isValid(endDate)) {
            dateQuery = {
                createdAt: startDate
            }
        }

        if (!isValid(startDate) && isValid(endDate)) {
            dateQuery = {
                createdAt: endDate
            }
        }

        let attendences = await Attendence.find({
            user: {
                $in: employeeIds
            },
            ...dateQuery
        }).populate("user");

        if (!attendences) attendences = [];

        return res.status(200).json(attendences);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};



// update all attendences

export const updateAttendences = async (req, res) => {
    try {
        const { ids, inTime, outTime, status } = req.body;

        if (!isValidRequestBody(req.body)) throw new Error('Invalid values.Please try again!');


        for (let id of ids) {

            let updateObj = {};
            if (isValid(status)) updateObj.status = status;

            if (isValid(inTime)) {
                let duration = calculateTimeDifference(inTime, outTime);
                updateObj.inTime = inTime;
                updateObj.duration = duration;
            }

            if (isValid(outTime)) {
                let duration = calculateTimeDifference(inTime, outTime);
                updateObj.outTime = outTime;
                updateObj.duration = duration;
            }

            if (isValid(inTime) && isValid(outTime)) {
                let duration = calculateTimeDifference(inTime, outTime);
                updateObj.duration = duration;
            }

            await Attendence.findOneAndUpdate({ _id: id }, { $set: updateObj }, { new: true });
        }

        return res.status(200).json({ message: 'Attendence updated successfully!' });

    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};
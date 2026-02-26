<?php

namespace Database\Seeders;

use App\Models\Bid;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Period;
use App\Models\Title;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    /**
     * Seed a realistic demo scenario with groups, titles, bids, and various statuses.
     */
    public function run(): void
    {
        // ── Additional Users ──
        $dosen3 = User::create([
            'name' => 'Dr. Lecturer Three',
            'email' => 'dosen3@ctms.com',
            'password' => bcrypt('password'),
            'role' => 'dosen',
        ]);

        $students = [];
        for ($i = 3; $i <= 12; $i++) {
            $students[] = User::create([
                'name' => "Student {$i}",
                'email' => "student{$i}@ctms.com",
                'password' => bcrypt('password'),
                'role' => 'mahasiswa',
            ]);
        }

        // ── Get existing seeded data ──
        $period = Period::latest()->first();
        $dosen1 = User::where('email', 'dosen1@ctms.com')->first();
        $dosen2 = User::where('email', 'dosen2@ctms.com')->first();
        $student1 = User::where('email', 'student1@ctms.com')->first();
        $student2 = User::where('email', 'student2@ctms.com')->first();

        if (!$period) {
            $this->command->warn('No active period found. Run PeriodSeeder first.');
            return;
        }

        // ── Update Period with bidding config ──
        $period->update([
            'bidding_start' => now()->subDays(7),
            'bidding_end' => now()->addDays(7),
            'min_group_size' => 2,
            'max_group_size' => 4,
            'max_supervise_load' => 5,
            'pdc1_start' => now()->addDays(14),
            'pdc1_end' => now()->addDays(44),
            'pdc2_start' => now()->addDays(60),
            'pdc2_end' => now()->addDays(90),
            'expo_date' => now()->addDays(100),
            'ta_start' => now()->addDays(100),
            'ta_end' => now()->addDays(150),
        ]);

        // ── Titles (no period_id — titles table does not have this column) ──
        $title1 = Title::create([
            'title' => 'Smart IoT Gateway for Campus Environmental Monitoring',
            'description' => 'Design and implement a smart IoT gateway system that collects environmental data (temperature, humidity, air quality) across campus buildings using ESP32 sensors and LoRa communication.',
            'lecturer_id' => $dosen1->id,
            'quota' => 2,
            'status' => 'APPROVED',
        ]);

        $title2 = Title::create([
            'title' => 'AI-Powered Academic Advisory Chatbot Using RAG',
            'description' => 'Build an intelligent chatbot for academic advising using Retrieval-Augmented Generation (RAG) with university curriculum data.',
            'lecturer_id' => $dosen1->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $title3 = Title::create([
            'title' => 'Blockchain-Based Certificate Verification System',
            'description' => 'Develop a decentralized system for issuing and verifying academic certificates using Ethereum smart contracts.',
            'lecturer_id' => $dosen2->id,
            'quota' => 2,
            'status' => 'APPROVED',
        ]);

        $title4 = Title::create([
            'title' => 'Real-Time Traffic Flow Prediction Using GNN',
            'description' => 'Implement a Graph Neural Network model for predicting traffic flow patterns in urban intersections using real sensor data.',
            'lecturer_id' => $dosen2->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        $title5 = Title::create([
            'title' => 'Federated Learning for Privacy-Preserving Healthcare Analytics',
            'description' => 'Build a federated learning framework for collaborative medical data analysis without sharing raw patient data.',
            'lecturer_id' => $dosen3->id,
            'quota' => 1,
            'status' => 'APPROVED',
        ]);

        // ── Group 1: READY_FOR_BIDDING with bids ──
        $group1 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group1->id, 'student_id' => $student1->id, 'is_leader' => true, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group1->id, 'student_id' => $student2->id, 'is_leader' => false, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group1->id, 'student_id' => $students[0]->id, 'is_leader' => false, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group1->id, 'title_id' => $title1->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id, 'proposed_supervisor_2_id' => $dosen2->id]);
        Bid::create(['group_id' => $group1->id, 'title_id' => $title3->id, 'priority' => 2, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen2->id, 'proposed_supervisor_2_id' => $dosen3->id]);
        Bid::create(['group_id' => $group1->id, 'title_id' => $title5->id, 'priority' => 3, 'status' => 'PENDING', 'proposed_supervisor_1_id' => $dosen3->id]);

        // ── Group 2: READY_FOR_BIDDING with bids ──
        $group2 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group2->id, 'student_id' => $students[1]->id, 'is_leader' => true, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group2->id, 'student_id' => $students[2]->id, 'is_leader' => false, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group2->id, 'title_id' => $title1->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id]);
        Bid::create(['group_id' => $group2->id, 'title_id' => $title2->id, 'priority' => 2, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen1->id, 'proposed_supervisor_2_id' => $dosen2->id]);

        // ── Group 3: FORMING (not enough members) ──
        $group3 = Group::create([
            'period_id' => $period->id,
            'status' => 'FORMING',
        ]);
        GroupMember::create(['group_id' => $group3->id, 'student_id' => $students[3]->id, 'is_leader' => true, 'period_id' => $period->id]);

        // ── Group 4: READY_FOR_BIDDING with bid on title4 ──
        $group4 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group4->id, 'student_id' => $students[4]->id, 'is_leader' => true, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group4->id, 'student_id' => $students[5]->id, 'is_leader' => false, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group4->id, 'student_id' => $students[6]->id, 'is_leader' => false, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group4->id, 'title_id' => $title4->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen2->id]);
        Bid::create(['group_id' => $group4->id, 'title_id' => $title3->id, 'priority' => 2, 'status' => 'PENDING', 'proposed_supervisor_1_id' => $dosen2->id, 'proposed_supervisor_2_id' => $dosen1->id]);

        // ── Group 5: READY_FOR_BIDDING competing for title5 ──
        $group5 = Group::create([
            'period_id' => $period->id,
            'status' => 'READY_FOR_BIDDING',
        ]);
        GroupMember::create(['group_id' => $group5->id, 'student_id' => $students[7]->id, 'is_leader' => true, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group5->id, 'student_id' => $students[8]->id, 'is_leader' => false, 'period_id' => $period->id]);
        GroupMember::create(['group_id' => $group5->id, 'student_id' => $students[9]->id, 'is_leader' => false, 'period_id' => $period->id]);

        Bid::create(['group_id' => $group5->id, 'title_id' => $title5->id, 'priority' => 1, 'status' => 'PENDING', 'lecturer_recommendation' => 'ACCEPT', 'proposed_supervisor_1_id' => $dosen3->id, 'proposed_supervisor_2_id' => $dosen1->id]);
        Bid::create(['group_id' => $group5->id, 'title_id' => $title1->id, 'priority' => 2, 'status' => 'PENDING', 'proposed_supervisor_1_id' => $dosen1->id]);

        $this->command->info('Demo data seeded: 5 titles, 5 groups, 11 bids (with proposed supervisors)');
    }
}
